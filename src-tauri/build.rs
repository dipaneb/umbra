fn main() {
    tauri_build::build();

    // tauri-build's own default Windows manifest declares a dependency on Common-Controls v6
    // (`windows-app-manifest.xml`, unconditionally included by `WindowsAttributes::new()`) —
    // tauri-build's own doc comment on `app_manifest` calls out that the dialog plugin needs
    // exactly this. But tauri-winres embeds it via `embed_resource::compile()`, which emits
    // `cargo:rustc-link-arg-bins=<res>` — Cargo scopes `-bins` to `[[bin]]` targets only, so
    // the manifest never reaches the `cargo test` harness binary.
    //
    // Without it, Windows binds the harness binary's implicit `comctl32.dll` import straight to
    // the legacy System32 copy instead of activating the v6 side-by-side assembly — and the
    // legacy copy doesn't export `TaskDialogIndirect`/`SetWindowSubclass`/`RemoveWindowSubclass`/
    // `DefSubclassProc`, which `tauri-plugin-dialog`'s Windows backend (`rfd`) imports. That's a
    // load-time import-table resolution failure (`STATUS_ENTRYPOINT_NOT_FOUND`, 0xc0000139)
    // before any test runs — confirmed by dumping the test binary's actual import table via
    // `dumpbin /imports` and cross-checking each imported symbol against the real export table
    // of the DLL it resolves to.
    //
    // Embedding the same manifest via `compile_for_tests` (scoped to
    // `cargo:rustc-link-arg-tests`) closes that gap without touching the real app, which already
    // gets the manifest tauri-build embeds by default.
    #[cfg(target_os = "windows")]
    {
        let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
        let manifest_path = out_dir.join("windows-test-manifest.xml");
        std::fs::copy("windows-test-manifest.xml", &manifest_path).unwrap();

        let rc_path = out_dir.join("windows-test-manifest.rc");
        std::fs::write(
            &rc_path,
            format!(
                "1 24 \"{}\"",
                manifest_path.display().to_string().replace('\\', "\\\\")
            ),
        )
        .unwrap();

        embed_resource::compile_for_tests(&rc_path, embed_resource::NONE)
            .manifest_required()
            .unwrap();
    }
}
