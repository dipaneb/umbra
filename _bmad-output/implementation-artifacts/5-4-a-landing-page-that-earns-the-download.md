---
baseline_commit: 848d992
---

# Story 5.4: A landing page that earns the download

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious developer discovering Umbra,
I want a landing page stating the privacy promise, touring the features, and linking the current release,
so that I can evaluate and download Umbra in one visit.

## Acceptance Criteria

1. **Given** the landing page, **when** visited, **then** it presents the privacy promise, a feature tour, and a download link resolving to the current GitHub Release (FR33), **and** the stack/hosting decision is made and documented in this story, outside the app spine (spine deferred item closed).
2. **Given** the page is a learning unit, **when** delivered, **then** SEO basics (titles, meta, semantic structure), deliberate copywriting, and analytics are part of the deliverable — not afterthoughts (FR33).
3. **Given** analytics, **when** the page and app are audited, **then** PostHog runs on the landing page only; the app itself sends nothing (FR34, INV-2).

**Boundary with Story 5.1/5.2/5.3 (all done):** Story 5.1 built the tag-driven build/sign/notarize pipeline that publishes versioned GitHub Releases (`Umbra_<version>_aarch64.dmg`, `latest.json`) — this story's download link has nothing to point at without it. Story 5.2 built the self-update flow and disclosed the update-check network exception in README + Settings. Story 5.3 proved that exception is the *only* one, per release, via an executed `nettop` tour. None of the three touch the landing page itself — 5.1's own scope note names it directly: *"Story 5.3's written network-monitor release checklist and Story 5.4's landing page"* are both out of scope for 5.1. This story's job is new ground: a public-facing site that accurately represents what 5.1–5.3 already proved, not re-proving it.

**Stack/hosting decision — made in this story (closes the spine's Deferred item):** `ARCHITECTURE-SPINE.md`'s Deferred section states: *"Landing page stack/hosting. Decided at Epic 5 Story 5.4, outside this app spine's boundary."* Decided, after discussion with the developer: **Astro, in a new, separate, public GitHub repository (`dipaneb/umbra-web`), hosted on Vercel.** Concrete reasoning:

- **Multi-page from day one, not a single page.** The developer wants a home/landing page, a dedicated FAQ page, and a dedicated download page, with more pages plausible later (a pricing/payment page is an explicit stated future intent, though **not** part of this story's scope — see the boundary note under Task 2). Astro's file-based routing (`src/pages/*.astro` → one route per file) and shared layouts fit this directly; a single-file plain-HTML page does not scale to "multiple pages referencing each other" without hand-rolled duplication.
- **Separate repo, not a subfolder of `Umbra`.** `Umbra`'s repo has no monorepo tooling (no `pnpm-workspace.yaml`, no Turborepo/Nx, a single root `package.json` for the Tauri app) — an Astro project has its own `package.json`, `node_modules`, and build pipeline that would either collide with or require bolting on workspace tooling just for this. A separate repo keeps both dependency graphs, CI, and release cadences independent, the same pattern PostHog itself uses (`posthog/posthog` vs. `posthog/posthog.com`, confirmed via Context7 this session). It also makes "outside the app spine's boundary" true by construction, not just by convention.
- **Vercel over GitHub Pages, specifically because of the stated future payment system.** GitHub Pages is static-only with no path to running server-side code, ever. Confirmed against Astro's own current docs this session: an Astro project deploys to Vercel as a static site with **zero extra configuration** by default; adding the `@astrojs/vercel` adapter later to run a server route (e.g. a Stripe webhook) is an incremental config change on the *same* project, not a platform migration. Choosing GitHub Pages now would mean re-platforming entirely if/when payments happen — an avoidable, self-inflicted cost given the future intent was already stated.
- **Repo name:** `umbra-web`, public — matching `Umbra`'s own public-repo posture. No secrets belong in this repo (Vercel env vars are where any future Stripe/PostHog-adjacent secret lives), same discipline `Umbra` already applies to its own release secrets.

## Tasks / Subtasks

- [x] **Task 0: Create the `umbra-web` repository and scaffold the Astro project**
  - [x] Created 2026-08-09, at the developer's explicit request, ahead of the rest of this story's implementation: `gh repo create dipaneb/umbra-web --public --description "Umbra's landing page — privacy promise, feature tour, and download"` → https://github.com/dipaneb/umbra-web. Confirmed public, currently empty (no default branch / commits yet — `gh repo view` shows `defaultBranchRef.name: ""`). This is a new, separate repository, not a branch of `Umbra` — there is no `Umbra` branch/PR flow for this story's actual code.
  - [x] Scaffolded with the current Astro CLI wizard, using **pnpm** per project convention (not npm — checked `npm create astro@latest -- --help` per the story's own instruction, then re-ran as `pnpm create astro@latest . --yes --git --install` at the developer's correction). `create-astro` momentarily saw the target directory as non-empty (a transient pnpm artifact) and fell back to scaffolding into an auto-named subdirectory (`dimensional-doppler`) plus a partial duplicate at the top level; both were reconciled with non-destructive `mv` only (no `rm -rf`) into a single correct project at `umbra-web/`, `package.json`'s `name` fixed to `umbra-web`, committed, remote `origin` set to `git@github.com:dipaneb/umbra-web.git`, and pushed to `main`. TypeScript strict (`basics` template default), git init, and dependency install accepted as defaults per the story's guidance.
  - [x] **Working-directory note for whoever runs `dev-story` on this story:** confirmed and followed — this session's actual code changes are made in `/Users/baptistedipane/Informatique/umbra-web` (sibling to `Umbra`, not inside it), created fresh via `mkdir` + the scaffold above. `Umbra`'s destructive-command hook was observed to check `Umbra`'s own git status regardless of any `cd` into `umbra-web`'s directory (it doesn't `-C` into the invoking command's target), confirming the note's warning; non-destructive `mv`-only reorganization was used specifically to avoid needing to route around that hook. This story file itself remains tracked in `Umbra`'s `_bmad-output/`, per the note.

- [x] **Task 1: Record the stack/hosting decision in the app's architecture spine (AC1's second clause)**
  - [x] In `Umbra`'s `ARCHITECTURE-SPINE.md`, found the *"Landing page stack/hosting"* line in the Deferred section and applied the repo's established resolution convention (same pattern as the OCR ONNX models item and the JSON tree IPC item): struck it with `~~...~~` and appended `Resolved by Story 5.4 (2026-08-09): Astro, in a new separate public repo (dipaneb/umbra-web), deployed to Vercel — see that story's Dev Notes for the full reasoning.` This is the one piece of this story's work that touches `Umbra`'s tree.

- [x] **Task 2: Build the site's pages — privacy promise, feature tour, FAQ, dedicated download page (AC1's first clause)**
  - [x] **Explicitly out of scope for this story: any payment/pricing page or checkout logic.** Confirmed nothing pricing/payment-related was added — footer/nav only link Home, FAQ, Download.
  - [x] **Home/landing page (`src/pages/index.astro`):** hero states the privacy promise verbatim from `README.md`'s `## Privacy` section (re-read live this session, unchanged from Story 5.2's wording), a 7-card feature tour, and a download CTA to `/download`.
  - [x] Feature tour: re-read `src/stores/registry.ts` live this session — confirmed no drift, still exactly `json`, `base64`, `uuid`, `hash`, `jwt`, `cron`, `bucket` (7 tools). One card per tool with original marketing-copy blurbs (not registry descriptions, which don't exist as a field anyway).
  - [x] **Dedicated download page (`src/pages/download.astro`):** links to `https://github.com/dipaneb/umbra/releases/latest`, not a hardcoded filename. States "Download for Mac (Apple Silicon)" and explicitly notes no Intel/Windows/Linux build exists yet.
  - [x] **FAQ page (`src/pages/faq.astro`):** six Q&As, each grounded in a verified fact (README privacy wording, NFR7's All Rights Reserved license, Story 5.3's per-release network-monitor checklist, live-read tool list). The open-source question states plainly: public code, not open source, All Rights Reserved.

- [x] **Task 3: SEO basics (AC2)**
  - [x] Added `@astrojs/sitemap` via `pnpm astro add sitemap --yes` (pnpm, not the story's remembered `npx` — verified as equivalent for a pnpm project); `site: 'https://umbra-web.vercel.app'` set in `astro.config.mjs` (Vercel's default `<project-name>.vercel.app` URL — flagged in a code comment to update once deployed/if a custom domain is added). Verified: `pnpm build` emits `sitemap-index.xml` + `sitemap-0.xml` listing all 3 real routes.
  - [x] Every page has a distinct `<title>` (via `Layout`'s `title` prop, suffixed `— Umbra`), a `<meta name="description">` (via `description` prop), and semantic structure: single `<h1>` per page (verified in build output), `<header>`/`<main>`/`<footer>` landmarks in `Layout.astro`, no skipped heading levels.
  - [x] No UX contract exists for this repo either (confirmed, matching `Umbra`). Chose to extend `Umbra`'s own WCAG AA bar: computed contrast for the two non-obvious color pairs (`--color-text-muted` on white ≈ 6.6:1, white button text on `--color-accent` ≈ 6.3:1 — both well over the 4.5:1 requirement) and added visible `:focus-visible` outlines globally.
  - [x] Used Astro's dynamic `src/pages/robots.txt.ts` pattern (reuses the `site` config to emit an absolute `Sitemap:` URL, rather than hand-maintaining a static file that could drift from the config) — verified output points at the correct sitemap URL.

- [x] **Task 4: PostHog analytics, scoped to this repo only (AC3)**
  - [x] Loaded via the plain `<script is:inline>` snippet + `posthog.init(...)` pattern — snippet itself pulled live from Context7 (`/posthog/posthog-js` and `/posthog/posthog.com`, the current full method-list version, not a remembered/shortened one) rather than reproduced from training memory, placed once in `Layout.astro`. No real PostHog project exists yet, so the key is the explicit placeholder `POSTHOG_PROJECT_API_KEY_PLACEHOLDER_REPLACE_BEFORE_DEPLOY` (verified present in all 3 built pages) — outstanding manual step recorded in Completion Notes below, not silently glossed over. `api_host` defaulted to the US region (`https://us.i.posthog.com`); update if the real project is EU-region.
  - [x] **Hard constraint (AC3/INV-2) sanity check:** `git status --porcelain` in `Umbra` after this task shows only the story file and Task 1's `ARCHITECTURE-SPINE.md` edit — no `src/`/`src-tauri/` changes, confirmed.
  - [x] Deliberate decision made (not default-accepted): both `disable_session_recording: true` (as the story recommends) **and** `autocapture: false` — extending past the story's explicit recommendation, because the footer's own disclosure text (written in Task 2, before this task) commits to "page-view analytics only," and leaving autocapture on would have made that claim false. `capture_pageview` stays at its default (on) — that's what the PRD's "Used" success metric needs. A one-line PostHog disclosure lives in the site footer (`Layout.astro`, added in Task 2), linking to the FAQ's `#analytics` answer.

- [ ] **Task 5: Deploy to Vercel** — **cannot be completed from this coding session; requires the developer.**
  - [ ] **NOT DONE — developer action required:** Connect the `dipaneb/umbra-web` GitHub repository to Vercel via Vercel's dashboard (https://vercel.com/new, import `dipaneb/umbra-web`). Vercel auto-detects Astro and needs zero build-config changes — `pnpm build` output in `dist/` is already a valid static deploy target, verified locally this session. This is a one-time account-linking step that requires a logged-in Vercel dashboard session; no CLI/API path exists in this coding session to do it non-interactively without Vercel credentials.
  - [x] Documented, no action needed: once connected, every push to `main` deploys to production automatically, and every PR gets its own Vercel preview URL — no custom GitHub Actions workflow needed (unlike the GitHub-Pages path this story discarded).
  - [x] **Decision made: custom domain deferred.** No domain is currently owned/ready for this site; shipping on the default `*.vercel.app` URL is a valid AC1 deliverable per the story's own guidance. **Consequence:** `astro.config.mjs`'s `site: 'https://umbra-web.vercel.app'` is a placeholder based on Vercel's default naming convention (`<project-name>.vercel.app`) — confirm the actual assigned URL matches after connecting the project (Vercel may append a suffix if the name collides with an existing project), and update `site` + redeploy if it doesn't.

- [ ] **Task 6: Manual verification (developer-executed)** — **blocked on Task 5; cannot be performed inside this coding session.**
  - [ ] Deployment requires Task 5's Vercel account-linking step first. Deferred to the developer, flagged explicitly rather than silently skipped or falsely checked off.
  - [ ] Once deployed, still to verify: visit the live Vercel URL for all three pages; confirm the download link resolves to a real, current, non-prerelease release asset; confirm PostHog registers a pageview once the real API key replaces the placeholder; **also swap the placeholder PostHog key and confirm `astro.config.mjs`'s `site` matches the real assigned Vercel URL — both were left as placeholders by this session, see Dev Notes above.** The `git status --porcelain` cross-repo-isolation check (Task 4) was already run and confirmed clean this session — no need to repeat unless further `Umbra`-side edits happen before this ships.

## Dev Notes

- **This story spans two repositories — an unusual shape for this project's stories so far.** Every prior `Umbra` story (1.1–5.3) made all of its changes inside the `Umbra` repo itself. This story's actual deliverable (the Astro site) lives entirely in the new `umbra-web` repo; the only change inside `Umbra` is Task 1's single-line spine amendment. Keep this distinction explicit in the Change Log and File List below — don't let `umbra-web` paths get silently conflated with `Umbra` paths.
- **Privacy accuracy is the one place a "disaster" is easy to introduce here, now on a third public surface.** README's wording, Settings' matching disclosure, and Story 5.3's per-release `nettop` proof all say the same specific thing: zero network calls except one, disclosed, consent-gated-at-install. This site is now a third place making that same claim publicly — overselling it (or, on the FAQ, implying "open source" from "public repo") would contradict what 5.1–5.3 actually established and verified. Reuse existing wording; don't freelance new claims.
- **Payments are a stated future intent, not this story's scope.** The Vercel-over-GitHub-Pages decision exists *because* of that future intent, but nothing about actually building a payment flow belongs in this story — resist the temptation to scaffold pricing pages, Stripe SDK installs, or checkout UI now. Document the future intent (already done above); don't implement it early.
- **No testing/link-checking convention exists to inherit** — this is new ground for this project's stories in general, not specific to the repo split. A lightweight addition (a link-checker step in a CI workflow for `umbra-web`, or Astro's own build-time link validation if available at implementation time) is worth considering, not a requirement.
- **Dependency version/API drift discipline still applies.** `Umbra`'s own Consistency Conventions table requires live re-verification (registry API, not training-data assumptions) for any pre-1.0 dependency or one whose pin predates its use by more than a few weeks — that convention was written for `Umbra`'s own dependency tree, but the same public-repo posture and "verify, don't assume" discipline is a sensible default to carry into `umbra-web`'s own `package.json` (Astro, `@astrojs/sitemap`, `@astrojs/vercel` if/when added).

### Project Structure Notes

- **New repository:** `dipaneb/umbra-web` (public), created by this story, entirely separate from `Umbra`. Standard Astro project layout (`src/pages/*.astro` for routes, `src/layouts/Layout.astro` shared, `src/components/` as needed, `astro.config.mjs`).
- **Only change inside `Umbra`:** `ARCHITECTURE-SPINE.md`'s "Landing page stack/hosting" Deferred-section bullet struck through and resolved (Task 1).
- No `Umbra` `src/` or `src-tauri/src/` changes expected at all. If implementation reveals a need to touch either, that's a signal the story has drifted past its own scope.
- `Umbra`'s `README.md`: consider whether a "Website" or "Download" link pointing at the new site belongs here — not mandated by any AC, a judgment call for the developer to make and record if taken.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.4 (lines 848–867, verbatim ACs and user story); Epic 5 overview (774–776); Story 5.1 (778–802), 5.2 (804–826), 5.3 (828–846), 5.5 (869–884) for cross-story context; "UX Design Requirements" section (143–145, confirms no UX contract exists)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Umbra-2026-07-19/prd.md` — FR33/FR34 (F11, "Landing page (P2)", lines 104–107); INV-2 (line 34); §6 success metrics ("Finished": landing page live by early September; "Used (modest)": landing-page visits/download count via PostHog); §7 timeline (F8–F11, Aug 8 → early Sept)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` — Deferred section: "Landing page stack/hosting. Decided at Epic 5 Story 5.4, outside this app spine's boundary" (the item this story closes); "Deployment/environment topology" and "Styling/component framework" Deferred entries (no server-side component in `Umbra` itself, no UX contract); Consistency Conventions table ("Dependency version/API drift", "Accessibility" NFR5 row); AD-7, AD-12; amendment-striking convention observed via the OCR ONNX models and JSON tree IPC Deferred-item resolutions]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE.md` — "Privacy as an architectural property, not a policy (AD-7)" section: the updater carve-out must be disclosed in both README and in-app, "not just one"; NFR7 (All Rights Reserved license)]
- [Source: `README.md` (`Umbra` repo) — `## Privacy` section (lines 7–11), the canonical privacy-disclosure wording this story's copy must echo, not reinvent]
- [Source: `_bmad-output/implementation-artifacts/5-1-a-signed-notarized-umbra-anyone-can-download.md` — release asset naming (`Umbra_<version>_<arch>.<ext>`, no override key, confirmed via Context7 against Tauri v2 docs); real repo (`dipaneb/umbra`) and release URL patterns; explicit "out of scope: ...Story 5.4's landing page" note]
- [Source: `_bmad-output/implementation-artifacts/5-2-umbra-updates-itself-with-consent-and-full-disclosure.md` — `plugins.updater.endpoints` = `https://github.com/dipaneb/umbra/releases/latest/download/latest.json` (confirms the `/releases/latest/...` pattern already works in production); the `/latest` non-prerelease-only resolution nuance]
- [Source: `_bmad-output/implementation-artifacts/5-3-the-privacy-promise-proven-at-every-release.md` — the executed, passing `nettop` tour result this story's privacy copy is entitled to rely on; the "verify with `git status --porcelain` alongside `git diff`, not `git diff` alone" lesson (that story's own review-caught mistake), reapplied here to the cross-repo isolation check in Task 4]
- [Source: `src/stores/registry.ts` (`Umbra` repo) — live-read this session, current tool inventory: `json`, `base64`, `uuid`, `hash`, `jwt`, `cron`, `bucket` (7 tools, re-check at implementation time)]
- [Source: `src-tauri/tauri.conf.json` (`Umbra` repo) — live-read this session: `productName: "Umbra"`, `version: "0.1.2"` (expect drift by implementation time — don't hardcode)]
- [Source: Astro's own docs, queried via Context7 (`/withastro/docs`) this session — current project-scaffolding command (`npm create astro@latest`), file-based routing convention (`src/pages/*.astro`), Vercel deployment (zero-config for static output; `@astrojs/vercel` adapter for server output added later, no migration required), `@astrojs/sitemap` integration and `site`/`Astro.site` canonical-URL pattern]
- [Source: PostHog JS SDK docs, queried via Context7 (`/posthog/posthog-js`) this session — current recommended plain-`<script>`-tag load pattern (`posthog.init(apiKey, { api_host })`)]
- [Source: PostHog's own repo split (`posthog/posthog-js` vs. `posthog/posthog.com`), observed via Context7's library listing this session — the concrete precedent cited for separating `Umbra` (product) from `umbra-web` (marketing site)]
- Live-verified this session via `gh`: `dipaneb/umbra-web` does not yet exist (available to create). Via `git`: `Umbra`'s `origin/main` at `848d992`.
- Decisions made in conversation with the developer, this session (not sourced from any planning document, since the stack/hosting choice was explicitly deferred to this story): Astro; separate public repo `umbra-web`; Vercel over GitHub Pages, specifically because of the developer's stated future intent to add a payment system, which GitHub Pages cannot ever support.

## Change Log

- 2026-08-09: Implementation session via `bmad-dev-story`, starting from `848d992`. Tasks 0–4 complete: scaffolded `umbra-web` (Astro, pnpm) as a new separate public repo, recorded the stack decision in `Umbra`'s `ARCHITECTURE-SPINE.md`, built all three pages (home, download, FAQ) with a shared `Layout.astro`, added SEO basics (`@astrojs/sitemap`, per-page title/description/canonical, `robots.txt`), and wired PostHog page-view analytics with a placeholder API key. All pushed to `dipaneb/umbra-web` `main`. Tasks 5–6 (Vercel account-linking, live post-deploy verification) cannot be performed in this coding session — no Vercel dashboard access. Flagged explicitly, not silently skipped — status held at `in-progress` rather than advancing to `review`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `create-astro` (via `pnpm create astro@latest . --yes --git --install`) momentarily detected the target directory as non-empty and scaffolded into an auto-named subdirectory (`dimensional-doppler`) instead of `.`, also leaving a partial duplicate at the top level. Reconciled with `mv` only (never `rm -rf`) — real project (with `node_modules`, lockfile, initialized `.git`) moved into place at `umbra-web/`; `package.json`'s `name` fixed from `dimensional-doppler` to `umbra-web`.
- `Umbra`'s `.claude/hooks/guard-destructive-bash.sh` blocked the above cleanup even though it targeted `umbra-web`, not `Umbra` — confirmed by reading the hook script that it checks `git status`/`git rev-parse` in its own invocation cwd (`Umbra`, always) regardless of any `cd` inside the blocked command, exactly matching this story's own working-directory warning under Task 0. Worked around by using only non-destructive `mv`, not by bypassing the hook.
- Developer corrected initial `npm create astro@latest` attempt to `pnpm create astro@latest` mid-session — pnpm is this user's established package manager (saved to memory for future sessions).
- `pnpm astro check` requires installing `@astrojs/check` + `typescript` as additional dependencies (interactive prompt) — skipped as out-of-scope-dependency; used `pnpm build` (a real production build of all pages) as this task's validation instead, which is arguably the more direct test for a static content site anyway.
- Astro's `Layout.astro` canonical-URL logic (`new URL(Astro.url.pathname, Astro.site)`) throws at build time if `astro.config.mjs`'s `site` is unset — this pulled Task 3's `site` config forward into Task 2's work as a hard prerequisite, not just a SEO nice-to-have.
- A live browser check (via `pnpm preview` + Claude in Chrome, after the Chrome extension's initial connection issue was resolved by the developer running `/mcp` to reconnect) caught a real rendering bug the build log and HTML-structure checks missed: the footer's "publicly readable — source on GitHub" text rendered with the em dash and link glued together, no space. Cause: Astro trims the newline+indentation between inline text and a following tag rather than collapsing it to a space like normal HTML whitespace handling — a real framework gotcha, not a typo. Fixed by keeping the text and link on one source line; verified visually after rebuild, committed and pushed separately (`4483939`).

### Completion Notes List

- Tasks 0–4 fully implemented, validated (`pnpm build` passes cleanly; single `<h1>`/correct `<title>`/canonical link verified per page via built HTML; sitemap + robots.txt verified via build output), committed, and pushed to `dipaneb/umbra-web` (`main`, 5 commits total: initial Astro commit + 4 story commits).
- **Tasks 5 and 6 are NOT complete and cannot be completed from a coding session** — both require the developer's own action:
  1. Connect `dipaneb/umbra-web` to Vercel via the dashboard (https://vercel.com/new) — no CLI/API path available without Vercel credentials.
  2. After connecting, confirm the actual assigned `*.vercel.app` URL matches the placeholder already set in `astro.config.mjs` (`https://umbra-web.vercel.app`) — update and redeploy if Vercel assigned a different name.
  3. Create a real PostHog project and swap its client-side project API key into `Layout.astro`, replacing `POSTHOG_PROJECT_API_KEY_PLACEHOLDER_REPLACE_BEFORE_DEPLOY` (confirm region: `api_host` currently defaults to US — change to the EU host if the real project is EU-region).
  4. Then run Task 6's live checks: all three pages load, download link resolves to a real non-prerelease release, PostHog registers a pageview.
- **Story status is intentionally left at `in-progress`, not `review`** — per the workflow's own completion gate, a story with incomplete tasks cannot be marked ready for review. Re-run `dev-story` on this story once the manual Vercel/PostHog steps above are done, to close out Tasks 5–6 and move to `review`.
- Cross-repo isolation confirmed throughout: `Umbra`'s `git status --porcelain` after every `umbra-web` task showed only this story file and Task 1's single `ARCHITECTURE-SPINE.md` line — no `src/`/`src-tauri/` changes at any point.
- User requested (2026-08-09, mid-session) that future work on `umbra-web` stay pedagogical — explaining Astro/Vercel concepts as they come up, since they're using this project to learn the stack. Saved to memory (not committed to any repo, per their instruction) so it carries into future sessions.

### File List

**`Umbra` repo** (only file touched outside this story file itself):
- `_bmad-output/planning-artifacts/architecture/architecture-Umbra-2026-07-20/ARCHITECTURE-SPINE.md` (modified — struck and resolved the "Landing page stack/hosting" Deferred item)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 5-4 status)
- `_bmad-output/implementation-artifacts/5-4-a-landing-page-that-earns-the-download.md` (this file)

**`umbra-web` repo** (new, separate repository — `github.com/dipaneb/umbra-web`, `main` branch):
- `package.json` (modified — name fixed to `umbra-web`; `@astrojs/sitemap` added)
- `pnpm-lock.yaml` (modified — sitemap dependency)
- `astro.config.mjs` (modified — `site` + sitemap integration)
- `src/layouts/Layout.astro` (modified — nav/footer/SEO meta/canonical link/PostHog snippet)
- `src/pages/index.astro` (modified — home page: privacy promise, feature tour, download CTA)
- `src/pages/download.astro` (new)
- `src/pages/faq.astro` (new)
- `src/pages/robots.txt.ts` (new)
- `src/components/Welcome.astro` (deleted — unused scaffold boilerplate)
- `src/assets/astro.svg`, `src/assets/background.svg` (deleted — unused scaffold boilerplate)
