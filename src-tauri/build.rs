fn main() {
    // On Windows, tauri-build's own default manifest embedding is disabled here and taken over
    // by `embed_manifest_everywhere` below — see its comment for why. Its icon/version-info
    // embedding (a separate part of the same `tauri_build::build()` call) is unaffected.
    #[cfg(target_os = "windows")]
    let attributes = tauri_build::Attributes::new()
        .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    #[cfg(not(target_os = "windows"))]
    let attributes = tauri_build::Attributes::new();

    if let Err(error) = tauri_build::try_build(attributes) {
        eprintln!("{error:#}");
        std::process::exit(1);
    }

    #[cfg(target_os = "windows")]
    embed_manifest_everywhere();
}

// tauri-build's own default Windows manifest declares a dependency on Common-Controls v6
// (`windows-manifest.xml` here duplicates it — tauri-build's own doc comment on `app_manifest`
// calls out that the dialog plugin needs exactly this). tauri-build normally embeds it via
// `tauri-winres`'s `WindowsResource::compile()`, which calls `embed_resource::compile()` —
// that emits `cargo:rustc-link-arg-bins=<res>`, and Cargo scopes `-bins` to `[[bin]]` targets
// only, so the manifest never reaches the `cargo test` harness binary.
//
// Without it, Windows binds the harness binary's implicit `comctl32.dll` import straight to the
// legacy System32 copy instead of activating the v6 side-by-side assembly — and the legacy copy
// doesn't export `TaskDialogIndirect`/`SetWindowSubclass`/`RemoveWindowSubclass`/
// `DefSubclassProc`, which `tauri-plugin-dialog`'s Windows backend (`rfd`) imports. That's a
// load-time import-table resolution failure (`STATUS_ENTRYPOINT_NOT_FOUND`, 0xc0000139) before
// any test runs — confirmed by dumping the test binary's actual import table via
// `dumpbin /imports` and cross-checking each imported symbol against the real export table of
// the DLL it resolves to.
//
// The fix is *not* `embed_resource::compile_for_tests` (link-arg scoped to `-tests`): Cargo
// rejects `cargo:rustc-link-arg-tests` outright ("invalid instruction") even during plain
// `cargo check` — `embed-resource`'s own doc comment on `compile_for_tests` already warns it's
// "unclear which [types], and likely to change" and recommends `compile_for_everything`
// instead. So instead of stacking a second, narrower manifest embed on top of tauri-build's
// own `-bins`-scoped one (risking two `RT_MANIFEST` resources landing in the same binary),
// `main` disables tauri-build's default manifest entirely and this embeds the one true copy
// via `compile_for_everything` (`cargo:rustc-link-arg=`, unscoped) — every artifact from this
// crate gets exactly one manifest resource, uniformly.
#[cfg(target_os = "windows")]
fn embed_manifest_everywhere() {
    let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let manifest_path = out_dir.join("windows-manifest.xml");
    std::fs::copy("windows-manifest.xml", &manifest_path).unwrap();

    let rc_path = out_dir.join("windows-manifest.rc");
    std::fs::write(
        &rc_path,
        format!(
            "1 24 \"{}\"",
            manifest_path.display().to_string().replace('\\', "\\\\")
        ),
    )
    .unwrap();

    embed_resource::compile_for_everything(&rc_path, embed_resource::NONE)
        .manifest_required()
        .unwrap();
}
