---
title: "Umbra — Landing Page Legal & Trust Surfaces"
status: draft
created: 2026-09-20
updated: 2026-09-20 (Step 4.4 — third-party asset licences)
---

# Umbra — Landing Page Legal & Trust Surfaces

> Companion to `_bmad-output/planning-artifacts/landing-page/README.md`'s Phase 4 and
> `landing-ia.md` §"Privacy policy"/§"Legal notice"/§"EULA" outlines. Each `§` below corresponds to
> one roadmap step; later steps append their own `§`, they don't rewrite this one. Not legal
> advice — per the roadmap's own Phase 4 preamble, this is an informed starting point with sources
> named, not a substitute for a qualified reviewer if you want one before launch.

## §1 — Privacy policy (Step 4.1)

**Method:** working session, grounded live against CNIL's own published guidance (`cnil.fr`,
fetched this session — "RGPD en pratique : communiquer en ligne," and the cookies/audience-
measurement pages) rather than a generic GDPR template, per the roadmap's Rule 6 discipline
extended to legal sourcing. PostHog's own current documentation (Context7, `/posthog/posthog.com`)
was checked live for exactly one fact this policy depends on and the client-side code can't answer:
whether IP addresses are captured. `umbra-web/src/layouts/Layout.astro` (the current, live
PostHog init block) was read directly rather than assumed from the roadmap's own summary of it.

### Why this page has real content, not a placeholder

`landing-ia.md` §1 already named the reason: PostHog's project is **EU-region**
(`api_host: 'https://eu.i.posthog.com'`, confirmed live in `Layout.astro` line 91), so GDPR governs
this site's own data processing regardless of what the Umbra *app* collects (row 1 of the claim
ledger, which is a separate, zero-network-calls claim about a different product surface). A site
whose entire pitch is privacy, shipping with no privacy policy, is the kind of gap a sharp visitor
notices — this step's own framing in the roadmap, restated here because it's the reason this page
gets real legal content rather than a footer sentence.

### Two decisions taken before drafting, and why

1. **No cookie-consent banner.** The site is cookieless by decision (roadmap decisions table), and
   CNIL's own exemption criteria for audience-measurement trackers (deliberation under Article 82 of
   the French Data Protection Act, `cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience`)
   line up with this project's PostHog configuration: **purpose limited to audience measurement**
   (performance, navigation, content analysis), **anonymous statistical output only**, **used
   exclusively by the site's own operator**, **no cross-referencing with other processing**, and
   **no cross-site tracking**. `Layout.astro`'s init call already sets `autocapture: false` and
   `disable_session_recording: true`, which is what makes this analysis hold regardless of which
   `persistence`/`cookieless_mode` option Step 6.8 eventually picks (a literal no-storage mode, or a
   tab-scoped `sessionStorage` identifier) — both configurations still meet every criterion above,
   so Step 6.8's fork doesn't change this policy's substance, only one sentence's wording (see the
   draft below). **This is the site's own good-faith assessment against CNIL's published criteria,
   not a CNIL certification** — PostHog is not on CNIL's published list of pre-approved,
   named-and-audited exempted solutions (that list names specific tools/configurations directly);
   the policy draft below says this explicitly rather than implying a certification that doesn't
   exist, the same overclaim discipline the claim ledger already applies to the app's own privacy
   and licence claims.

2. **Legal basis: legitimate interest, not consent.** Because the processing meets the
   audience-measurement exemption criteria above, GDPR's legal basis is Article 6(1)(f)
   ("legitimate interest") rather than consent — standard CNIL doctrine for this category of
   low-risk, anonymized, non-profiling analytics. Not asserted as a certainty independent of a
   qualified reviewer; asserted as the correct default reading of the criteria this project's own
   configuration meets.

### A fact the client-side code can't answer, flagged rather than guessed

PostHog's own GDPR-compliance documentation (Context7, `/posthog/posthog.com`, this session) states
that **organizations on PostHog Cloud EU have IP data capture disabled by default for new
projects**, but that this is a per-project dashboard toggle (**Settings → Project → General → "IP
data capture configuration"**), not something visible in `Layout.astro`'s public init call. This is
the same category of fact Step 6.8's "PostHog dashboard audit" already exists to check (the
roadmap's own "Physically impossible without you" list — a login-gated dashboard setting, not
something a working session can verify). The draft below states this honestly as **unconfirmed
pending that audit**, rather than asserting either "we collect your IP" or "we don't" without
having looked. Once Step 6.8 confirms the toggle's state, this page's "Data collected" section
gets one sentence resolved, not rewritten.

### DPO / record-of-processing — checked, not surfaced on the page

CNIL's guidance on small/personal-site compliance doesn't name a Data Protection Officer or a
formal Article 30 record of processing as required at this scale (occasional, non-systematic,
non-large-scale processing, no special-category data) — noted here for the record since it was
checked, not because it needs a section on the public page itself.

### The draft — EN

> **Privacy policy**
> *Last updated: [date — set at launch]*
>
> **What this page covers**
> This policy covers only this website (umbra-web) and the anonymous analytics it collects about
> visits to it. It does not cover the Umbra desktop application, which is a separate product with
> its own, much stricter privacy disclosure — see the [FAQ](/faq#analytics) and the app's own
> README for that claim. Nothing you do inside the Umbra app is described by this page.
>
> **Data collected**
> This site uses [PostHog](https://posthog.com), hosted in the EU, for anonymous page-view
> analytics. Session recording and autocapture are both turned off. With that configuration,
> visiting this site can generate the following data:
> - The page path and URL you viewed, and the page you came from, if any
> - Your browser, operating system, device type, and screen size, read from standard browser
>   information — not from a fingerprinting script
> - *[If Step 6.8 ships `cookieless_mode: "always"`: no identifier of any kind links your page
>   views together.]* / *[If Step 6.8 ships `sessionStorage` persistence: a temporary identifier,
>   scoped to your current browser tab, that groups your page views together for this visit only
>   and is discarded when you close the tab.]* — exactly one of these two sentences ships,
>   depending on Step 6.8's decision.
> - If you click "Download," which platform you selected (macOS, Windows, or Linux) — this tells
>   us which platform to prioritize, not who you are
> - If you click "Watch on GitHub" or a "Notify me" link — again, only that the click happened
> - *[Any Step 6.8-defined modal-interaction events, once named]*
> - Standard analytics metadata: a timestamp and an event name for each of the above
>
> **Unconfirmed, checked before launch:** whether this site's PostHog project stores the IP address
> your browser connects from. PostHog disables this by default for new EU-hosted projects, but it's
> a project setting, not something this page's authors can verify from the site's published code —
> this line will be resolved, one way or the other, before this policy ships.
>
> **What's not collected**
> - No cookies
> - No session recordings, no screen replays, no autocapture of clicks or form fields
> - No cross-site tracking, no advertising identifiers, nothing shared with ad networks
> - No account, no email address, no name — this site has no sign-up, login, or newsletter
> - No data leaves the EU for this site's own analytics — the PostHog project we use is EU-hosted
>
> **Legal basis & your rights**
> We process this data under "legitimate interest" (GDPR Article 6(1)(f)): it's limited to
> anonymous, aggregate measurement of how this site is used, for our own use only, and isn't
> combined with any other data source or used to track you elsewhere.
>
> You have the right, under GDPR, to access, correct, or request deletion of data held about you,
> to object to this processing, and to lodge a complaint with the CNIL (cnil.fr), the French data
> protection authority. In practice, because this analytics has no account, email, or persistent
> identifier tied to it, there is usually nothing we can look up against your specific identity even
> on request — that's a consequence of collecting less, not a way of avoiding these rights. If you
> believe we hold something identifiable about you, or have any other question, contact us below.
>
> **Data controller & contact**
> [placeholder — see "Not resolved here" below]
>
> **Changes to this policy**
> This page is updated whenever what we collect changes — for example, when a new analytics event
> ships. Changes are dated at the top of this page.

### The draft — FR

> **Politique de confidentialité**
> *Dernière mise à jour : [date — à définir au lancement]*
>
> **Ce que couvre cette page**
> Cette politique ne couvre que ce site web (umbra-web) et les données d'analyse anonymes qu'il
> collecte sur ses visites. Elle ne couvre pas l'application de bureau Umbra, qui est un produit
> séparé avec sa propre déclaration de confidentialité, bien plus stricte — voir la
> [FAQ](/faq#analytics) et le README de l'application pour cette information. Rien de ce que vous
> faites dans l'application Umbra n'est décrit par cette page.
>
> **Données collectées**
> Ce site utilise [PostHog](https://posthog.com), hébergé dans l'UE, pour des statistiques
> anonymes de pages vues. L'enregistrement de session et la capture automatique sont tous deux
> désactivés. Avec cette configuration, la visite de ce site peut générer les données suivantes :
> - La page et l'URL consultées, et la page d'origine, le cas échéant
> - Votre navigateur, système d'exploitation, type d'appareil et taille d'écran, lus depuis les
>   informations standard du navigateur — pas via un script de fingerprinting
> - *[Si l'étape 6.8 déploie `cookieless_mode: "always"` : aucun identifiant ne relie vos pages
>   vues entre elles.]* / *[Si l'étape 6.8 déploie une persistance `sessionStorage` : un
>   identifiant temporaire, limité à votre onglet de navigateur actuel, qui regroupe vos pages vues
>   pour cette visite uniquement et qui est supprimé à la fermeture de l'onglet.]* — une seule de
>   ces deux phrases sera publiée, selon la décision de l'étape 6.8.
> - Si vous cliquez sur « Télécharger », la plateforme choisie (macOS, Windows ou Linux) — cela
>   nous indique quelle plateforme prioriser, pas qui vous êtes
> - Si vous cliquez sur « Suivre sur GitHub » ou un lien « Me prévenir » — là encore, uniquement le
>   fait que le clic a eu lieu
> - *[Tout événement d'interaction avec une fenêtre modale défini par l'étape 6.8, une fois nommé]*
> - Métadonnées d'analyse standard : horodatage et nom de l'événement pour chacun des points ci-dessus
>
> **Non confirmé, à vérifier avant le lancement :** si le projet PostHog de ce site conserve
> l'adresse IP depuis laquelle votre navigateur se connecte. PostHog désactive ce réglage par défaut
> pour les nouveaux projets hébergés dans l'UE, mais il s'agit d'un réglage propre au projet, non
> vérifiable depuis le code public du site — ce point sera tranché, dans un sens ou dans l'autre,
> avant la publication de cette politique.
>
> **Ce qui n'est pas collecté**
> - Aucun cookie
> - Aucun enregistrement de session, aucune capture d'écran, aucune capture automatique des clics
>   ou des champs de formulaire
> - Aucun suivi entre sites, aucun identifiant publicitaire, rien de partagé avec des régies
>   publicitaires
> - Aucun compte, aucune adresse e-mail, aucun nom — ce site ne propose ni inscription, ni
>   connexion, ni newsletter
> - Aucune donnée ne quitte l'UE pour les statistiques propres à ce site — le projet PostHog
>   utilisé est hébergé dans l'UE
>
> **Base légale et vos droits**
> Nous traitons ces données sur la base de « l'intérêt légitime » (article 6(1)(f) du RGPD) : ce
> traitement se limite à une mesure d'audience anonyme et agrégée, pour notre seul usage, sans
> croisement avec une autre source de données ni utilisation pour vous suivre ailleurs.
>
> Vous disposez, en vertu du RGPD, d'un droit d'accès, de rectification ou de suppression des
> données vous concernant, d'un droit d'opposition à ce traitement, et du droit d'introduire une
> réclamation auprès de la CNIL (cnil.fr). En pratique, cette mesure d'audience n'étant liée à
> aucun compte, e-mail ou identifiant persistant, il n'y a généralement rien que nous puissions
> retrouver à partir de votre identité, même sur demande — une conséquence du fait de collecter
> moins, pas un moyen de contourner ces droits. Si vous pensez que nous détenons une donnée vous
> identifiant, ou pour toute autre question, contactez-nous ci-dessous.
>
> **Responsable du traitement et contact**
> [emplacement réservé — voir « Not resolved here » ci-dessous]
>
> **Modifications de cette politique**
> Cette page est mise à jour à chaque changement de ce qui est collecté — par exemple, lors de
> l'ajout d'un nouvel événement d'analyse. Les modifications sont datées en haut de cette page.

### Checked against the ledger

Row 13 (site analytics disclosure) governs the footer's short sentence, not this page — but both
must describe the same underlying facts. This page's "Data collected"/"What's not collected"
sections are the long-form version of row 13's claim; if Step 6.8 changes what's actually
collected, both the footer sentence and this page need the same update in the same PR, per row 13's
own "Owner / update trigger" column.

### Not resolved here, deliberately

- **"Data controller & contact."** Per the developer's decision this session, this section ships as
  a placeholder — matching the `⟨developer name⟩` placeholder pattern `landing-copy.md` §5 already
  uses for the footer's attribution line, and the same "not invented at outline stage" discipline
  `landing-ia.md`'s Legal-notice outline already applies to publisher identity. This project's own
  `CLAUDE.md` privacy rule forbids writing a real name or personal email into a file this session
  could commit; a GDPR-compliant privacy policy still needs *some* way to reach the controller for a
  data-rights request, so before this page ships, the developer needs to decide and supply: an
  identity to name (a legal name, or a sufficiently identifying public handle — GitHub's
  `dipaneb` is already public via the repo URL and may or may not be sufficient on its own; not
  decided here) and a contact channel that isn't a personal inbox (e.g., a dedicated address or
  form) — the same open item `landing-ia.md`'s Legal-notice section flags for Step 4.2's publisher
  identity, since both pages need the same underlying answer.
- **IP-capture toggle.** Flagged above; Step 6.8's dashboard audit is the only source that can
  close it, not a working session.
- **The `cookieless_mode` vs. `sessionStorage` sentence.** Ships as whichever bracketed sentence
  matches Step 6.8's actual choice — both are drafted above so Step 6.8 doesn't have to return to
  this file to finish it, only to delete one sentence.
- **Launch date.** The "Last updated" / "Dernière mise à jour" date is set when this page actually
  ships, not now.
- **Modal-interaction event names.** Bracketed placeholder above, pending Step 6.8 naming them
  concretely (§4 of `landing-strategy.md` calls them "the two modal events" without final names).
- **A qualified legal review.** Per this file's own preamble and the roadmap's Phase 4 framing, this
  draft is sourced and reasoned but not a substitute for one, if the developer wants one before
  launch.

### Feeds directly into

- **Step 4.2** (legal notice) — **turned out not to share the same open question this note
  originally assumed.** See §2 below: LCEN's own non-professional-publisher exemption resolves
  Step 4.2's publisher-identity field independently, without waiting on this page's "Data
  controller & contact" decision. Only this page's own placeholder (a GDPR requirement, not an
  LCEN one) is still open.
- **Step 6.3** (pages) — builds `/privacy` from this draft.
- **Step 6.5** (i18n) — the FR draft above is the actual French copy for this route, not a
  placeholder needing later translation.
- **Step 6.8** (PostHog dashboard audit, analytics wiring) — closes the IP-capture toggle and the
  `cookieless_mode`/`sessionStorage` fork; both are one-sentence edits to this file once resolved,
  not a redraft.
- **Step 8.1** (pre-launch checklist) — "Data controller & contact" placeholder filled in, "Last
  updated" date set, and the IP-capture/persistence sentences resolved are all concrete items that
  checklist can carry forward from here.

---

## §2 — Legal notice / mentions légales (Step 4.2)

**Method:** working session. Started from the roadmap's own pointer to "CNIL/service-public
guidance," but neither of those actually states the current governing article — a live Légifrance
lookup (`legifrance.gouv.fr`, this session) was the real source of truth and surfaced a correction
before any copy got written (below). Vercel's own published privacy policy
(`vercel.com/legal/privacy-policy`, fetched live this session) supplied the hosting-provider address,
rather than a third-party corporate-registry aggregator, which returned several conflicting addresses
for Vercel Inc. and isn't the entity's own statement of itself.

### Correction found before drafting: the roadmap's own legal basis is stale

The README's Step 4.2 entry, and most secondary sources still in general circulation, point to
**LCEN Article 6-III** for the professional/non-professional publisher distinction. That article **no
longer exists** — France's SREN law (loi n° 2024-449 of 21 May 2024, adapting French law to the EU
Digital Services Act) restructured the LCEN, and the identification requirements now live at
**Article 1-1**, in force since 23 May 2024. The substance carried over — this isn't a case like
Step 1.3's stale objection, where the underlying fact changed — but citing the repealed article number
in a document meant to ground real copy would have been wrong on its face if anyone checked it later.

### The finding that changes what this page needs to say

Article 1-1, **section II** (quoted from Légifrance, this session):

> "Les personnes éditant à titre non professionnel un service de communication au public en ligne
> peuvent ne tenir à la disposition du public, pour préserver leur anonymat, que le nom, la
> dénomination ou la raison sociale et l'adresse du fournisseur de services d'hébergement, sous
> réserve de lui avoir communiqué les éléments d'identification personnelle [...]. Les fournisseurs
> de services d'hébergement sont assujettis au secret professionnel [...] pour tout ce qui concerne
> la divulgation de ces éléments d'identification personnelle [...] Ce secret professionnel n'est
> pas opposable à l'autorité judiciaire."

This is a broader exemption than the README's own Step 4.2 framing assumed ("you can generally
withhold a home address" — true, but understates it). A **non-professional** editor may withhold
**their entire identity** from the public page and disclose **only the hosting provider's name and
address**, on the condition that they've already given their own real identifying details to the
host directly (an account-level fact with Vercel, never published) — and the host is bound by
professional secrecy, disclosable only to a judicial authority, never on request.

**Is Umbra-web non-professional under this test?** The statute's line is whether editing the site is
the person's professional *activity* (a business), not whether the site is well-made or serious. This
site: promotes a free application with no pricing, donation, or paid tier (the roadmap's own
"Monetisation: none" decision); is run by one individual, not a registered publishing business; and
its About/recruiter page (`landing-ia.md` §2 — a project write-up aimed at a technical interviewer)
is a personal portfolio page, not a commercial service offering in itself. This reads as the
textbook non-professional case. **Stated as this document's own good-faith assessment, not a
certified legal conclusion** — the same discipline §1 applies to its own GDPR legal-basis analysis.

**Consequence for the publisher-identity fork §1 left open:** §1's "Feeds directly into" note above
assumed Step 4.2 needed the same developer decision as the privacy policy's "Data controller &
contact" placeholder. It doesn't, fully — LCEN and GDPR are different laws with different tests, and
only one of them exempts non-professional publishers from naming themselves:

| | Legal basis | Personal identity required on the public page? |
|---|---|---|
| **Legal notice** (this page) | LCEN Art. 1-1, II | No — non-professional exemption applies; host-only disclosure is sufficient |
| **Privacy policy** "Data controller & contact" (§1) | GDPR Art. 13/14 | Still open — GDPR has no equivalent non-professional carve-out for the controller-identification duty; a reachable contact channel is still needed |

**Developer decision, this session:** given the exemption, ship **host-only, fully anonymous** — no
name or handle on this page, not even the already-public GitHub handle `dipaneb`. The draft below
reflects that choice.

### One action item this page's copy can't execute

The exemption is only valid if the site's operator has actually given Vercel their real identifying
details on the Vercel account itself — ordinary account signup information, never published anywhere
on the site. This session can't verify or perform that (it's a Vercel-account action, not a copy
decision), so it's carried forward as a concrete pre-launch item rather than assumed silently true.

### The draft — EN

> **Legal notice**
> *(mentions légales)*
>
> **Publisher**
> This site is published on a non-professional, non-commercial basis by an individual, under
> Article 1-1, II of French law n° 2004-575 of 21 June 2004 ("LCEN"). That provision lets a
> non-professional publisher keep their own identity off this page and disclose only their hosting
> provider's details instead — the option used here. The site's operator has given their real
> identity to the hosting provider directly, as the law requires; it is not published on this page,
> and can only be disclosed by the host to a judicial authority, never on request.
>
> **Hosting provider**
> Vercel Inc.
> 440 N Barranca Avenue #4133
> Covina, CA 91723
> United States
>
> **Contact**
> *[placeholder — resolved together with the [Privacy policy](/privacy)'s "Data controller &
> contact" section; see that page's own open item]*
>
> **Intellectual property**
> Umbra's source code is public and readable at
> [github.com/dipaneb/umbra](https://github.com/dipaneb/umbra), but it is not open source: the
> repository is source-available, All Rights Reserved. You may read the code to verify how the app
> works. You may not copy, modify, merge, publish, distribute, sublicense, or sell it, in whole or
> in part, without the copyright holder's prior written consent — see the repository's `LICENSE`
> file for the full terms. The separate [end-user licence](/eula) governs downloading and running
> the compiled application, not the source code itself.
>
> This page concerns only the publication of this website. It says nothing about the Umbra desktop
> application's own data practices — see the [Privacy policy](/privacy) and the application's own
> README for that.

### The draft — FR

> **Mentions légales**
>
> **Éditeur**
> Ce site est édité à titre non professionnel et non commercial par un particulier, en application
> de l'article 1-1, II de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie
> numérique (« LCEN »). Cette disposition permet à un éditeur non professionnel de ne pas divulguer
> son identité sur cette page et de ne communiquer au public que les coordonnées de son hébergeur —
> c'est l'option retenue ici. L'éditeur du site a communiqué son identité réelle à l'hébergeur
> directement, comme la loi l'exige ; elle n'est pas publiée sur cette page et ne peut être
> divulguée par l'hébergeur qu'à l'autorité judiciaire, jamais sur simple demande.
>
> **Hébergeur**
> Vercel Inc.
> 440 N Barranca Avenue #4133
> Covina, CA 91723
> États-Unis
>
> **Contact**
> *[emplacement réservé — résolu conjointement avec la section « Responsable du traitement et
> contact » de la [politique de confidentialité](/privacy) ; voir le point resté ouvert sur cette
> page]*
>
> **Propriété intellectuelle**
> Le code source d'Umbra est public et consultable sur
> [github.com/dipaneb/umbra](https://github.com/dipaneb/umbra), mais ce n'est pas un logiciel libre
> ou open source : le dépôt est en « source-available », tous droits réservés. Vous pouvez lire le
> code pour vérifier vous-même le fonctionnement de l'application. Vous ne pouvez pas le copier, le
> modifier, le fusionner, le publier, le distribuer, le sous-licencier ou le vendre, en tout ou
> partie, sans le consentement écrit préalable du titulaire des droits — voir le fichier `LICENSE`
> du dépôt pour les conditions complètes. La [licence d'utilisation](/eula), distincte, régit le
> téléchargement et l'exécution de l'application compilée, et non le code source lui-même.
>
> Cette page ne concerne que la publication de ce site. Elle ne dit rien des pratiques de
> l'application de bureau Umbra en matière de données — voir la
> [politique de confidentialité](/privacy) et le README de l'application à ce sujet.

### Checked against the ledger

Row 9 (licence) governs the "source-available, not open source" language above; this page's
Intellectual-property section restates row 9's exact terminology rather than improvising new
wording. No other ledger row applies to this page — it makes no privacy, platform, or product claim.

### Not resolved here, deliberately

- **"Contact."** Shares §1's open item, not a new one: the same non-personal contact channel the
  developer still needs to decide for the privacy policy's "Data controller & contact" section
  serves this page too. One decision, two pages, not two decisions.
- **Confirming the Vercel-account identity disclosure actually happened.** A pre-launch action item
  (Step 8.1), not something this session can check or perform.
- **Launch date / "last updated."** Not set until the page actually ships.
- **A qualified legal review.** Same caveat as §1 — sourced and reasoned, not a substitute for one.

### Feeds directly into

- **Step 4.3** (EULA) — this page's Intellectual-property section cross-references `/eula` rather
  than duplicating its terms; Step 4.3 should keep that boundary (source-code rights here, compiled-
  app usage rights there).
- **Step 6.3** (pages) — builds `/legal` from this draft.
- **Step 6.5** (i18n) — the FR draft above is the actual French copy for this route.
- **Step 8.1** (pre-launch checklist) — carries forward two concrete items: confirm the Vercel
  account holds the operator's real identity (the exemption's precondition), and resolve the shared
  "Contact" channel this page and §1 both need.

---

## §3 — End-user licence for the binary / EULA (Step 4.3)

**Method:** working session. No new live legal research was needed — the placement decision and the
two real comparables (CleanShot X's full 16-section EULA, and Titanium Software/OnyX's short
~550–600-word, seven-clause license) were already checked live at Step 2.1 (`landing-ia.md` §1) and
the exact seven-clause structure was already locked at Step 2.4 (`landing-ia.md`'s EULA outline).
This step's job is filling that structure with actual terms, checked against the repo's own
`LICENSE` file (read live this session) and ledger row 9, not re-deciding placement or shape.

### The gap this page closes

The repo's `LICENSE` (All Rights Reserved, read live this session) grants zero rights to anyone —
"No permission is granted to any person to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of this software... in whole or in part." Read literally, that
covers the compiled binary too, which sits in direct tension with a site whose own Download page
says "download this." This page is the resolution: a **separate** grant, scoped narrowly to running
the compiled application, that the copyright holder extends to anyone who downloads it — distinct
from, and not a modification of, the source `LICENSE`, which stays exactly as restrictive as it is
today for the source code itself.

### Structure and scope, per the already-locked outline

Seven clauses, per `landing-ia.md`'s EULA outline and the OnyX precedent's length (short, not
CleanShot's 16-section document — nothing here needs to cover purchases, subscriptions, or
third-party services, since Umbra has none of those): **License grant** · **No redistribution** ·
**No reverse engineering or modification** · **"As-is," no warranty** · **Limitation of liability** ·
**Termination** · **Contact**. Must claim exactly Step 4.3's four named points (personal use
permitted, no redistribution, no reverse engineering, provided as-is with no warranty); must not
claim any right to the source code itself, which stays the repo `LICENSE`'s exclusive subject —
this page cross-references it rather than restating or loosening it.

**Deliberately left out:** a governing-law / jurisdiction clause. It's a common EULA clause but
isn't one of the four points Step 4.3 named or one of the seven clauses `landing-ia.md` already
locked, so adding one here would be scope creep past what was actually decided — flagged below as
an optional pre-launch addition instead of added unilaterally.

### The draft — EN

> **End User License Agreement**
> *Last updated: [date — set at launch]*
>
> This agreement covers only the compiled Umbra application you download and run — not the source
> code. Umbra's source code is public and readable, but it is not licensed for reuse in any form;
> see the repository's `LICENSE` file and the [Legal notice](/legal) for that separate question. By
> downloading, installing, or running Umbra, you agree to the terms below.
>
> **1. License grant**
> The copyright holder grants you a personal, non-exclusive, non-transferable, revocable licence to
> install and run Umbra, free of charge, for your own personal use.
>
> **2. No redistribution**
> You may not redistribute, sell, rent, lease, sublicense, host for others' use, or otherwise make
> Umbra — modified or unmodified — available to any third party. If someone else wants Umbra, point
> them to the official download page, not a copy of the installer.
>
> **3. No reverse engineering or modification**
> You may not reverse engineer, decompile, disassemble, or otherwise attempt to derive the source
> code from the compiled application, and you may not modify, patch, or create derivative works from
> it. This clause concerns the compiled binary specifically; the source code itself is separately
> public and governed by the repository's own `LICENSE`, which grants no reuse rights either — see
> the [Legal notice](/legal).
>
> **4. "As-is," no warranty**
> Umbra is provided "as is," without warranty of any kind, express or implied, including but not
> limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.
> You use it at your own risk.
>
> **5. Limitation of liability**
> To the maximum extent permitted by law, the copyright holder is not liable for any damages arising
> from your use of, or inability to use, Umbra — including data loss, business interruption, or any
> other direct or indirect damages — even if advised of the possibility of such damages.
>
> **6. Termination**
> This licence ends automatically if you breach any of these terms. On termination, you must stop
> using Umbra and delete any copies you have.
>
> **7. Contact**
> [placeholder — resolved together with the [Privacy policy](/privacy)'s "Data controller & contact"
> section and the [Legal notice](/legal)'s "Contact" section; see those pages' own open item]

### The draft — FR

> **Contrat de licence utilisateur final**
> *(CLUF)*
> *Dernière mise à jour : [date — à définir au lancement]*
>
> Ce contrat ne couvre que l'application Umbra compilée que vous téléchargez et exécutez — pas le
> code source. Le code source d'Umbra est public et consultable, mais n'est concédé sous aucune
> licence de réutilisation ; voir le fichier `LICENSE` du dépôt et les [mentions légales](/legal) pour
> cette question distincte. En téléchargeant, installant ou exécutant Umbra, vous acceptez les
> conditions ci-dessous.
>
> **1. Concession de licence**
> Le titulaire des droits vous concède une licence personnelle, non exclusive, incessible et
> révocable, pour installer et exécuter Umbra, gratuitement, pour votre usage personnel.
>
> **2. Pas de redistribution**
> Vous ne pouvez pas redistribuer, vendre, louer, sous-licencier, héberger pour l'usage d'un tiers, ou
> rendre autrement disponible Umbra — modifié ou non — à un tiers. Si quelqu'un d'autre souhaite
> Umbra, orientez-le vers la page de téléchargement officielle, pas vers une copie de l'installeur.
>
> **3. Pas d'ingénierie inverse ni de modification**
> Vous ne pouvez pas effectuer d'ingénierie inverse, décompiler, désassembler, ou tenter de quelque
> autre manière d'obtenir le code source à partir de l'application compilée, et vous ne pouvez pas la
> modifier, la corriger (« patcher ») ou en créer des œuvres dérivées. Cette clause concerne
> spécifiquement le binaire compilé ; le code source lui-même est public séparément et régi par le
> `LICENSE` du dépôt, qui n'accorde lui non plus aucun droit de réutilisation — voir les
> [mentions légales](/legal).
>
> **4. Fourni « en l'état », sans garantie**
> Umbra est fourni « en l'état », sans garantie d'aucune sorte, expresse ou implicite, y compris,
> sans s'y limiter, les garanties de qualité marchande, d'adéquation à un usage particulier et
> d'absence de contrefaçon. Vous l'utilisez à vos propres risques.
>
> **5. Limitation de responsabilité**
> Dans toute la mesure permise par la loi, le titulaire des droits ne peut être tenu responsable des
> dommages résultant de votre utilisation d'Umbra, ou de votre incapacité à l'utiliser — y compris la
> perte de données, l'interruption d'activité, ou tout autre dommage direct ou indirect — même s'il a
> été informé de la possibilité de tels dommages.
>
> **6. Résiliation**
> Cette licence prend fin automatiquement en cas de manquement à l'une de ces conditions. En cas de
> résiliation, vous devez cesser d'utiliser Umbra et supprimer toute copie en votre possession.
>
> **7. Contact**
> [emplacement réservé — résolu conjointement avec la section « Responsable du traitement et contact »
> de la [politique de confidentialité](/privacy) et la section « Contact » des
> [mentions légales](/legal) ; voir le point resté ouvert sur ces pages]

### Checked against the ledger

Row 9 (licence) governs this page's own "not licensed for reuse" / source-`LICENSE` cross-references
— restates row 9's exact terminology ("source-available, not open source... no right to copy,
modify, redistribute, or reuse without written consent") rather than improvising new wording, the
same discipline §2 already applied. No other ledger row applies — this page makes no privacy,
platform, or product-capability claim, only a usage-rights one.

### Not resolved here, deliberately

- **"Contact."** Shares §1's and §2's open item, not a new one — one non-personal contact channel the
  developer still needs to decide, referenced from all three legal pages rather than decided three
  times.
- **Governing law / jurisdiction clause.** Not one of Step 4.3's four named points or the outline's
  seven clauses, so not added here — flagged as an optional pre-launch addition if the developer (or
  a qualified reviewer) wants one; French law is the natural default given the copyright holder's own
  location and the `/legal` page's own LCEN basis, but that's a call for whoever adds the clause, not
  assumed here.
- **Launch date / "last updated."** Not set until the page actually ships.
- **A qualified legal review.** Same caveat as §1 and §2 — sourced and reasoned against real
  comparables and the repo's own `LICENSE`, not a substitute for one.

### Feeds directly into

- **Step 6.3** (pages) — builds `/eula` from this draft.
- **Step 6.5** (i18n) — the FR draft above is the actual French copy for this route.
- **`landing-copy.md` §4** (Download page) — already carries the one-sentence EULA reference this
  page is linked from ("By downloading, you agree to the End User License Agreement"); no change
  needed there, this page just supplies what that link now points to.
- **`landing-legal.md` §2** (legal notice) — already cross-references `/eula` from its own
  Intellectual-property section; the boundary holds as designed (source-code rights in `/legal`,
  compiled-app usage rights here, neither duplicates the other).
- **Step 8.1** (pre-launch checklist) — carries forward the same shared "Contact" placeholder as §1
  and §2, plus this page's own "Last updated" date and the optional governing-law decision.

---

## §4 — Third-party asset licence record (Step 4.4)

**Method:** working session. No new sourcing was needed for the fonts — `DESIGN.md` (line 158)
already names the licence — but the claim was re-verified live against the actually-installed
packages in `Umbra`'s own `node_modules` rather than taken on the roadmap's summary alone, the same
discipline §1 applied to PostHog's docs and §2 applied to Légifrance. This step's own framing
("just needs recording as checked") means there's no drafting here — it's a compliance record, not
page copy, and it doesn't get its own EN/FR draft the way §1–§3 did.

### Geist Sans / Geist Mono — checked, clear

`DESIGN.md` §"Typography" (line 158) states both typefaces ship under the SIL Open Font License 1.1,
"free for commercial use and embeddable in paid software with no royalties or in-app attribution
requirement." Verified live against `Umbra`'s own dependencies, not re-derived from that summary:

- `package.json` pins `@fontsource/geist-sans` and `@fontsource/geist-mono`, both `5.3.0`.
- Each installed package's own `package.json` states `"license": "OFL-1.1"`.
- Each package bundles its own `LICENSE` file, the SIL OFL 1.1 in full, headed "Geist Sans and Geist
  Mono Font, (C) 2023 Vercel, made in collaboration with basement.studio."

OFL 1.1 permits exactly what `umbra-web` needs: the fonts (unmodified, no new name claimed) may be
"bundled, embedded, redistributed and/or sold with any software," with no royalty and no requirement
to display attribution on the page itself — the only condition is that the licence text travels with
the font files if they're redistributed, which `@fontsource`'s own package already satisfies (each
package ships its `LICENSE` alongside the font assets it exports). **Not yet applicable in
`umbra-web` today:** Step 5.1 (web type scale) hasn't run, and the current site's `Layout.astro` uses
a plain system-font stack as a placeholder (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
Helvetica, Arial, sans-serif` — no Geist reference at all yet). Nothing to flag as a gap: there's no
licence obligation on a font that isn't shipped yet. Recording this now, ahead of the build, means
whoever runs Step 5.1/6.x doesn't have to re-derive the licence question — pulling in
`@fontsource/geist-sans`/`geist-mono` (the same packages the app already uses, so the same verified
terms apply) satisfies it without a new check.

### Hubot Sans — checked, clear (addendum, Step 5.1, 2026-09-21)

Not part of this step's original scope — added because Step 5.1 (web type scale), run after this
step, reopened "same families as the app" as a real decision and landed on a new third typeface for
the display roles (`hero`/`h1`/`h2` only; body/label/caption/code stay Geist as recorded above).
Recorded here rather than left as a silent gap in an already-checked step, the same discipline
`landing-design.md` §1 names for why this addendum exists at all.

- GitHub's own display companion to its Mona Sans UI face (`github/hubot-sans`), designed
  specifically as a restrained technical/mechanical voice for headers in developer-tool branding.
- Licence verified live against the repository's own `LICENSE` file: SIL Open Font License 1.1 —
  identical terms to Geist above (free commercial use, no royalty, no in-app attribution requirement,
  licence text travels with the font files).
- Distribution checked live via `npm view`, not assumed from the naming resemblance to Geist's own
  packages: both `@fontsource-variable/hubot-sans` and `@fontsource/hubot-sans` exist on the public
  npm registry at `5.3.0`, `"license": "OFL-1.1"` — the identical `@fontsource` route Geist already
  uses, so Step 6.2 self-hosts it the same way, no new delivery mechanism needed.
- **Not yet applicable in `umbra-web` today**, same status as Geist/Phosphor above: Phase 6 hasn't
  run, so nothing ships yet — recording this now means Step 6.2 inherits a closed licence question.

### Phosphor Icons — checked, clear

`DESIGN.md`'s Card section (amended for Story 7.1) documents the app's icon system as
`@phosphor-icons/vue`, resolved through `src/shell/icons.ts`. `landing-ia.md` §5's content model
gives every tool page an `icon` frontmatter field (`src/content/tools/*.md`), which reads as the
landing page intending to render the same Phosphor icon per tool the app already uses in its
icon-badges — for visual consistency between product and site, not a new icon choice. Verified live
against the installed package, not from memory:

- `Umbra`'s `package.json` pins `@phosphor-icons/vue` at `^2.2.1`.
- The installed package's own `package.json` states `"license": "MIT"`, and it bundles its own
  `LICENSE` file with the standard MIT text, copyright Phosphor Icons, 2020.

MIT is unconditional for this use beyond one requirement: "The above copyright notice and this
permission notice shall be included in all copies or substantial portions of the Software" — a
condition on redistributing the source/asset files themselves (satisfied automatically by depending
on the npm package rather than hand-copying individual SVG paths out of it), not a requirement to
display anything on the public page. **Not yet applicable in `umbra-web` today, same status as the
fonts:** no `@phosphor-icons/*` package is in `umbra-web`'s own `package.json` yet, and Phase 5/6
haven't wired the feature-tour grid or tool-page icons in. **One open question this step doesn't
resolve, deliberately, since it's a build decision, not a licence one:** whether the eventual Astro
build depends on `@phosphor-icons/vue` directly (unused in an Astro site with no Vue runtime),
whichever official Phosphor package fits Astro's own component model, or plain static SVG exports of
the specific icon set the tool pages need — all three are equally clear under MIT; picking one is
Step 6.x's job, not this one's.

### Imagery — checked, none exists yet

The site currently ships two image assets, both in `umbra-web/public/`: `favicon.svg` and
`favicon.ico`. Read live — both are `create-astro`'s own stock scaffold art (a generic mark, not
Umbra's), matching `landing-ia.md`/README's own Step 5.6 note that the favicon "is already present
but still Astro's default art." Astro's starter templates are MIT-licensed under the `withastro/astro`
repository's own licence, so there is no third-party clearance question — but the asset is a
placeholder Step 5.6 replaces with the developer's own mark (Step 5.5), not a long-term dependency
worth a permanent record here.

Beyond those two files, `umbra-web` has **no other imagery** — no product screenshots, no OG share
image, no illustration, no stock photography. This isn't a gap this step needs to chase: Phase 5
(Steps 5.2–5.5) hasn't run, and every image it will produce is the developer's own material —
screen captures of Umbra itself (5.3), a composed OG card (5.4), and a hand-designed logo mark (5.5)
— not licensed third-party stock. **Recorded as checked, not skipped:** there is currently nothing
third-party to clear in this category, the same "audited, found nothing to fix" outcome Step 3.5's
social-proof pass recorded rather than leaving silently unaddressed. If a future step (a diagram, an
icon set beyond Phosphor, a stock photo for the About page) introduces outside imagery, it gets its
own entry here rather than assumed covered by this one.

### Checked against the ledger

No claim-ledger row governs third-party asset licensing directly — the ledger tracks the site's
*factual claims about the product* (privacy, platform support, the app's own licence), while this
section tracks the site's *own supply-chain compliance* for what it's built from. Row 9 (the app's
All-Rights-Reserved source licence) is unrelated: that row is about who may reuse `Umbra`'s source
code, not about the fonts/icons `umbra-web` itself depends on.

### Not resolved here, deliberately

- **Whether `umbra-web` self-hosts the fonts via `@fontsource/*` or another delivery method** (a CDN,
  a different self-hosting approach) — Step 5.1/6.x's call; this record confirms the licence is clear
  for the `@fontsource` route specifically, since that's the route already proven out in `Umbra`
  itself, not for every conceivable alternative.
- **Which concrete Phosphor package (or static-export approach) `umbra-web` adopts** — flagged above;
  a build decision for Step 6.x, not a licence question this step needs to settle.
- **A public "credits"/acknowledgements listing** for the OFL/MIT-licensed assets. Neither licence
  requires one (OFL needs the licence text to travel with redistributed font files, which the
  packaging already handles; MIT needs the notice to travel with copied source, satisfied by
  depending on the package). Not adding one — flagged as an optional, low-cost addition if the
  developer wants the courtesy.
- **A qualified legal review.** Same caveat as §1–§3, though the stakes here are lower — these are
  standard, unmodified, well-known open licences on unmodified assets, not a novel legal question.

### Feeds directly into

- **Step 5.1** (web type scale) and **Step 6.x** (build) — adopt `@fontsource/geist-sans`/
  `geist-mono` `5.3.0` with the licence question already closed; no re-check needed unless the
  version pin changes. Step 5.1 itself added Hubot Sans for the display roles (`hero`/`h1`/`h2`) —
  see the addendum above, closed the same session it was decided.
- **Step 5.2** (layout) and **Step 6.3** (tool pages) — whichever Phosphor delivery method is chosen
  for the feature-tour grid and the 9 tool-page icons inherits this section's MIT clearance.
- **Step 5.5/5.6** (logo, favicon) — replaces the two Astro-default placeholder files this section
  found; the developer's own new SVGs carry no third-party licence question to record here.
- **Step 8.1** (pre-launch checklist) — nothing carried forward from this section specifically; it's
  the one Phase 4 step that closed clean, with only build-sequencing choices (not open legal
  questions) left for later steps to make.
