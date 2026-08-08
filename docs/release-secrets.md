# Release secrets — what they are, why they exist, and where to find them

This document exists for one reason: in a year, when your Apple Developer Program
subscription comes up for renewal, or when you start a new project and half-remember
"didn't I have to set up eight GitHub secrets for something like this?", you should be
able to reconstruct the whole picture from this file alone, without re-deriving it from
scratch or re-reading Story 5.1's implementation history.

**This file never contains a secret value — only names, purposes, and locations.**
Values live in exactly one place each (a GitHub Actions secret, or a local file outside
this repo), listed per-entry below.

## Why this project has secrets at all

Umbra's release pipeline (`.github/workflows/release.yml`) builds, code-signs, and
notarizes the app on every version tag, then publishes it as a GitHub Release. Signing
and notarization are Apple's way of proving "this app really came from this identified
developer and hasn't been tampered with" — which is what lets a downloaded `.dmg` open
on a fresh Mac without a Gatekeeper warning (this story's whole point). Proving that
requires real, private credentials tied to your paid Apple Developer account. Those
credentials must exist somewhere the release workflow can read them at build time, but
must **never** be readable in the repo itself (anyone with read access to the repo would
otherwise be able to sign software as you). GitHub Actions **repository secrets** are
built for exactly this: encrypted at rest, injected into a workflow run as environment
variables, never exposed in logs, and never visible again through the GitHub UI or API
once you've saved them — including to you. That last part is why this document matters:
if you lose track of *what* a secret was for, GitHub can't remind you; you have to
either regenerate it or dig through documentation like this one.

Separately, a *second* keypair (the "updater signing key") exists for a completely
different purpose — proving future auto-update packages (Story 5.2) really came from
this same pipeline, independent of Apple entirely. It's documented here too, since it's
the same "generate once, store carefully, never lose it" shape as the Apple credentials.

## Quick reference

| Name | What it is | Lives in | Rotatable? |
|---|---|---|---|
| `APPLE_CERTIFICATE` | Base64 of your Developer ID Application `.p12` | GitHub secret only | Re-export from Keychain Access |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting that `.p12` | GitHub secret only (you chose it) | Re-export with a new password |
| `KEYCHAIN_PASSWORD` | Arbitrary password for a throwaway CI keychain | GitHub secret only (you chose it) | Change anytime, no downstream effect |
| `APPLE_ID` | Your Apple ID email | GitHub secret + your memory | N/A, it's just your email |
| `APPLE_PASSWORD` | An app-specific password for that Apple ID | GitHub secret + [appleid.apple.com](https://appleid.apple.com) | Yes, generate a new one anytime |
| `APPLE_TEAM_ID` | Your Developer Program Team ID (`8PD8J6B7CA`) | GitHub secret + Apple's account page | No, fixed for the life of the membership |
| `TAURI_SIGNING_PRIVATE_KEY` | Content of the updater's private signing key | GitHub secret + `~/.tauri/umbra-updater.key` | Only by generating a brand-new keypair (breaks old updater trust) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password protecting that key | GitHub secret only (you chose it) | Only alongside a new keypair |
| `GITHUB_TOKEN` | Auth for `tauri-action` to publish the Release | Automatic — **you never create this** | N/A |

All 8 secrets you created live at
`github.com/dipaneb/umbra/settings/secrets/actions` — that page will list the *names*
even after you've forgotten everything else; use it alongside this document.

---

## The root of everything: Apple Developer Program membership

Everything below depends on one paid, annual subscription.

- **Cost:** $99/year (USD; may vary by country), billed to whatever payment method you
  enrolled with. [developer.apple.com/programs](https://developer.apple.com/programs/)
  confirms this pricing.
- **Team ID:** `8PD8J6B7CA` — visible in your account's Membership Details page, and
  also embedded directly in your Developer ID Application certificate (its `OU` field).
  This ID doesn't change for the life of the membership.
- **Renewal:** Apple Developer Program memberships typically auto-renew unless you
  cancel — but confirm your actual renewal date and auto-renewal status directly in your
  account at [developer.apple.com/account](https://developer.apple.com/account/),
  since that's account-specific and not something documented on a public page.
- **What happens if you let it lapse — read this carefully, it's not fully confirmed:**
  the commonly understood behavior (industry consensus, not something I could confirm
  against a single authoritative Apple document during this story) is that Apple revokes
  certificates tied to an expired membership, so **new** builds can no longer be signed
  or notarized — but apps you already shipped and users already downloaded keep working,
  since Gatekeeper checks a locally cached notarization ticket rather than re-contacting
  Apple every launch. **Do not rely on this from memory alone when the decision is
  actually in front of you** — verify current policy via Apple Developer Support or
  their account documentation at that time, since this is exactly the kind of detail
  Apple could change.

**If you start a new project:** this membership and the Developer ID Application
certificate it issues are tied to *you as a developer*, not to Umbra specifically. The
same certificate can sign a different app's release pipeline without regenerating
anything Apple-side — you'd only need to redo the GitHub-secrets side (a new repo means
a new `github.com/<repo>/settings/secrets/actions` page to populate) and generate a
*separate* `TAURI_SIGNING_PRIVATE_KEY` (see below — that one genuinely is per-project).

---

## GitHub Actions secrets, one by one

All 8 live at `github.com/dipaneb/umbra/settings/secrets/actions`. GitHub never lets you
view a secret's value again once saved — only overwrite or delete it. If you need a
value again, you must regenerate it from the source described below.

### `APPLE_CERTIFICATE`
- **What:** Your Developer ID Application certificate + private key, bundled as a
  `.p12` file, then base64-encoded (GitHub secrets are text fields; `.p12` is binary).
- **Why:** `tauri-action` imports this into a temporary CI keychain to actually sign
  the app bundle during the release build.
- **Source of truth:** the `.p12` file itself, saved somewhere on this Mac outside the
  repo (e.g. `~/secure/apple-developer/Certificates.p12` — put it wherever you keep
  sensitive local files, just never inside a git working tree). If you still have that
  file, re-run `base64 -i Certificates.p12 | pbcopy` and paste. If you've lost it, you
  must export a fresh one from Keychain Access (System keychain → search "Developer ID
  Application" → export), or if the certificate itself is gone too, generate a
  brand-new CSR and certificate from scratch via
  [developer.apple.com/account/resources/certificates/list](https://developer.apple.com/account/resources/).
- **Certificate identity (for reference):** shows up as `Developer ID Application:
  <Your Name> (<Team ID>)` in Keychain Access and in `security find-identity -v -p
  codesigning`'s output — that's the exact string `release.yml`'s certificate-import
  step greps for. Issued 2026-08-08, **expires 2031-08-09**. Mark that expiry somewhere
  you'll actually see it — a new certificate (and a new `APPLE_CERTIFICATE` secret)
  will be needed before then. (Run `security find-identity -v -p codesigning` yourself
  if you ever need the current SHA-1 fingerprint — it's not reproduced here since it's
  only valid for this specific certificate, not a stable reference value.)

### `APPLE_CERTIFICATE_PASSWORD`
- **What:** The password you set when exporting the `.p12` above.
- **Why:** `tauri-action` needs it to unlock that `.p12` during import — a `.p12` file
  is itself encrypted, this is the decryption key.
- **Source of truth:** only your memory / password manager at the time you exported.
  Not recoverable if forgotten — you'd need to re-export the `.p12` with a new password.

### `KEYCHAIN_PASSWORD`
- **What:** An arbitrary password with no meaning beyond this workflow.
- **Why:** `release.yml` creates a brand-new, temporary macOS keychain on the CI runner
  for the few minutes a release build takes (`security create-keychain -p
  "$KEYCHAIN_PASSWORD" build.keychain`), then imports the certificate into it. This
  password just unlocks that ephemeral keychain — it's destroyed when the job ends.
- **Source of truth:** none needed — if you ever need to change it, just pick a new
  string and update the GitHub secret. Nothing else references this value.

### `APPLE_ID`
- **What:** The email address of the Apple ID enrolled in the Developer Program.
- **Why:** Required by Apple's `notarytool` (invoked internally by `tauri-action`) to
  authenticate the notarization request.
- **Source of truth:** whichever Apple ID you used to enroll — check
  [developer.apple.com/account](https://developer.apple.com/account/) if you forget
  which one.

### `APPLE_PASSWORD`
- **What:** An **app-specific password** for that Apple ID — explicitly *not* your real
  Apple ID login password. Apple's own explanation:
  [support.apple.com/en-us/102654](https://support.apple.com/en-us/102654) ("Sign in to
  apps with your Apple Account using app-specific passwords").
- **Why:** notarization authenticates over an API that requires this dedicated
  credential type rather than your real password, both for security (it's scoped and
  revocable independently of your main password) and because Apple's 2FA flow doesn't
  work in a headless CI environment.
- **Source of truth:** generate at appleid.apple.com → Sign-In and Security →
  App-Specific Passwords. You can have several active at once, each individually
  revocable — if you ever suspect this one leaked, revoke it there and generate a fresh
  one without touching anything else in this list.

### `APPLE_TEAM_ID`
- **What:** `8PD8J6B7CA` — see "The root of everything" above.
- **Why:** Required when an Apple ID belongs to more than one team, to disambiguate
  which team's certificate/notarization context to use.
- **Source of truth:** your account's Membership Details page, or the `OU` field of any
  certificate issued to this team.

### `TAURI_SIGNING_PRIVATE_KEY`
- **What:** The raw content of `~/.tauri/umbra-updater.key` — a Tauri-generated
  signing keypair, entirely separate from anything Apple-related.
- **Why:** This is **not** for code signing or Gatekeeper — it's for Story 5.2's future
  in-app updater, so a running copy of Umbra can verify that an update package really
  came from this release pipeline and wasn't tampered with in transit. `tauri-action`
  uses it at build time (independent of whether the updater plugin is even installed
  yet) to sign the update artifacts it produces alongside the `.dmg`.
- **Source of truth:** `~/.tauri/umbra-updater.key` on this Mac — **confirmed outside
  this git repository**, and **this is the one credential in this whole list that
  cannot be regenerated without consequence**: if you lose it, you can generate a new
  keypair, but every copy of Umbra already in users' hands has the *old* public key
  baked into its `tauri.conf.json` at the time it was built, and won't trust updates
  signed by a new key. This is exactly why Task 7 called for backing this file up to two
  separate offline locations — if that backup hasn't happened yet, it should be the
  first thing you do after reading this document, before anything else.
- **This one is genuinely per-project** — don't reuse it for a future app; generate a
  fresh keypair per project (`pnpm tauri signer generate`), the same way you would a new
  SSH key for a new server.

### `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **What:** The password set during `pnpm tauri signer generate`.
- **Why:** protects the private key file above the same way `APPLE_CERTIFICATE_PASSWORD`
  protects the `.p12`.
- **Source of truth:** only your memory / password manager from generation time — not
  recoverable if forgotten, same caveat as `APPLE_CERTIFICATE_PASSWORD`.

### `GITHUB_TOKEN`
- **What:** A token GitHub itself injects into every Actions run automatically.
- **Why:** lets `tauri-action` create the GitHub Release and upload build artifacts to
  it via the GitHub API.
- **You never create or store this** — it doesn't appear in your repo's secrets list at
  all, and there's nothing to back up or remember here. Listed only so you don't
  mistakenly go looking for it.

---

## Local files that matter but aren't GitHub secrets

Two things on this Mac are as important as the GitHub secrets themselves, since they're
the *source* several of those secrets were derived from:

| File | What | Status |
|---|---|---|
| `~/.tauri/umbra-updater.key` | Updater private key (see `TAURI_SIGNING_PRIVATE_KEY` above) | **Not yet backed up to two offline locations** as of Story 5.1 — this is the single most important outstanding item from this whole story. |
| `~/.tauri/umbra-updater.key.pub` | Updater public key | Not sensitive — its content is already committed in `src-tauri/tauri.conf.json`'s `plugins.updater.pubkey`. Losing this file specifically doesn't matter. |
| `Certificates.p12` (wherever you saved it, outside the repo) | Certificate + private key bundle (source of `APPLE_CERTIFICATE`) | Exists on this Mac, outside the repo. Consider it as important as the updater key — back it up the same way. |
| `CertificateSigningRequest.certSigningRequest` (same location) | The original CSR used to request the certificate | Low value once the certificate exists; keep only if you want a record of exactly what was requested. |

---

## If you start a new project

What carries over from this whole setup, and what doesn't:

- **Reusable as-is:** the Apple Developer Program membership itself, and the Developer
  ID Application certificate/`.p12` — both are tied to you/your team, not to Umbra. A
  new project's release workflow can use the exact same `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` values.
- **Needs regenerating per-project:** `TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (generate a fresh keypair — see above for why),
  and `KEYCHAIN_PASSWORD` (arbitrary anyway, no reason to reuse).
- **Needs re-creating regardless, mechanically:** all 8 GitHub secrets, since GitHub
  secrets are scoped per-repository — even values you're reusing have to be re-pasted
  into the new repo's own Settings → Secrets and variables → Actions page.

---

*Generated 2026-08-08 during Story 5.1's implementation (`bmad-dev-story`), at the
developer's request, as a durable reference independent of this story's own file
(`_bmad-output/implementation-artifacts/5-1-a-signed-notarized-umbra-anyone-can-download.md`),
which documents the *implementation* rather than serving as a long-term secrets runbook.*
