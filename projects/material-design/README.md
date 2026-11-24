# PercuManager Material foundation phases 1 and 2

Development only. Based on PercuManager 1.7.2 at 91d9b51e6060bbe24960aecef8f639b71df6d659.
Date: 2026-11-23 Europe/Madrid. Branch: feature/material-foundation.
No remote push, production deployment, real Google access or real data writes.

## Phase 1 baseline

baseline.json records 183 source hashes and 224 HTML element contracts (IDs, data attributes,
form field identifiers, types, methods and ARIA attributes), the source commit, version and four viewport sizes.
The material-foundation tests enforce the original HTML after removing the added CSS links.
The guard removes the explicitly recorded presentation patches before comparing the original contracts.

## Phase 2 shared foundation

- tokens.css owns semantic colors, surfaces, typography, spacing, shape, elevation, targets and motion.
- components.css applies shared primitives to existing controls and future pm-* components.
- legacy-bridge.css maps old variables and selectors; no existing class, ID or data attribute is removed.
- group-courses.css is a CSS-only entry point that composes the existing course stylesheet and the foundation.
- index.html loads the foundation in the page and the repertoire template.
- Only the stylesheet URL is changed in group-courses-ui.js and sandbox/repertoire-ui.js,
  so their isolated roots load exactly the same visual foundation.
- The preview server only gains a static allowlist for these four CSS files.

No application version, auth, API, queue, schema, synchronization or Calendar rule changed.
Existing backend and business files are hash-verified without decoding/re-encoding legacy files.
The desktop primary section button uses intrinsic width rather than the missing compiled sm:w-auto utility.
The mobile navigation is 80 px plus safe area; reserved page and selection spacing share that token.
bottomInset() remains unchanged and continues to measure the actual navigation.

## Compatibility strategy

Legacy index styles, app-ui.css, review-ui.css, course/repertoire/report/map styles remain in place.
The new primitives use targeted !important declarations where the existing cascade already uses
inline or important styles. Roles are supplied through custom properties so selected, secondary
and disabled states can override base appearance consistently. No cascade layers are introduced.
Remove compatibility selectors and importance progressively in the later cleanup phase, after
their old consumers have been migrated.

## Validation

Existing Node suite: 312 original tests passed. Three added contract/integrity tests passed.
The first integrity check exposed its own UTF-8 decoding assumption for a legacy file; the guard
was corrected to hash untouched files as bytes. The legacy file was not modified.

Browser checks use sandbox/preview-production.cjs and synthetic data exclusively:
- 320x568, 390x844, 768x1024, 1280x900: no horizontal page/report overflow.
- Bottom navigation fixed on mobile and in normal flow at tablet/desktop widths.
- Shared tokens in repertoire and the course dialog isolated roots.
- Course selection save and alphabetic groups.
- Independent learned/reviewing flags and verified batch save.
- Manual session performed preview, confirmation, reload and checked/disabled state.
- Reports: prepare PDF, close/reopen preserves prepared file; personal calculation unchanged.
- Disabled action contrast, active tabs, focus indication and primary/secondary action hierarchy.
- All new styles are local and reduced-motion rules are provided.

Run: node --test sandbox/material-foundation.test.cjs
Run existing suite: npm run test:pruebas
Preview: node sandbox/preview-production.cjs (default localhost:3011).
The review session uses HORAS_PREVIEW_PORT=3014 without changing app configuration.

## Not part of this delivery

Phases 5 and 6 remain pending: specialized module refinements and removal of duplicated legacy CSS.
Phases 3 and 4 are documented below.
No claims of a completed whole-app redesign or production publication.
Existing workflows, quotas and state semantics remain the reference.

## Before any later publication

Obtain user review of this local result. Update affected pre-existing JS resource cache versions,
run the required checks, and publish only when authorized. Do not deploy this development branch
or turn the isolated preview into a production server.

## Mobile filter alternative

The course filters now show their existing Estado and Tipo selects directly, with accessible labels,
56 px controls and a single column at 380 px or below. Their values, callbacks, cache and transport
are unchanged. The precise presentation-only replacements are recorded in filter-presentation.json
and reversed by the integrity guard before comparing the original business source.
18 focused course and integrity checks pass. Browser checks cover all/unclassified/active filters,
the disabled type rule and shared repertoire filters at 320 and 390 px. Development only.

Primary mobile reference supplied by the user: Xiaomi 14T Pro. The filter alternative was also
checked at 412x915 CSS pixels as an Android viewport reference, not a claim of physical-device testing.

## Phase 3 — shared shell and consultation views

Development-only presentation changes on the same isolated branch. User review is required before publishing.

- screens.css composes the shared header/navigation, session cards, group cards and FullCalendar shell.
- Mobile header actions now retain icon and text. New session/group uses a 56 px floating button,
  16 px above the 80 px navigation plus safe area; hidden while a root modal is open.
- Session cards show existing start/end times, explicit payment state and labeled actions.
- Calendar titles add the existing payment state as text; event sources, dates, callbacks and options are unchanged.
- presentation.js reads the existing authentication controls to mirror their connection state.
  It never reads credentials or calls authentication, storage, transports or APIs.
- Existing IDs, data actions, handlers, disabled rules, confirmations, filters and business rules remain.
- phase3-presentation.json enumerates the exact reversible source replacements. The foundation
  guard reverses them before checking original HTML contracts and business-source hashes.
- Only the visible create-session label changes in the existing mobile E2E expectation.
  The browser E2E suite was not run through remote CI, because no branch was pushed or deployed.

Validation: all 318 Node tests passed (3.35 s), including three focused phase-3 tests covering
rendered session states/escaping, unchanged Calendar options/callbacks and passive connection status.
Browser review uses synthetic data only at 320x568, 390x844, 412x915, 768x1024 and 1280x900.
No page/card/calendar horizontal overflow; mobile navigation fixed, tablet/desktop in flow.
412x915 is a CSS viewport reference for the Xiaomi 14T Pro, not a physical-device test.
At 320 px, all three header actions stretch equally when a label wraps.

The synthetic payment save retained verification. Session archive review was opened and cancelled;
new-session and existing Calendar editor were opened and closed without saving sessions.
Changing session group/payment/performed filters and opening/reopening reports added zero preview
API requests in the measured sequence. Course organization and alphabetical groups still work.
Repertoire group hash is retained on selection and cleared on return to Lista.
No real Sheets, Detalle, session or Calendar data was read or modified.

Before later authorized publication, update cache versions for changed existing JS resources and
run the required release checks. This delivery changes neither production version nor remote code.

## Phase 4 — forms, reviews, drafts and location

Local development only. Existing business JS, auth, APIs, quotas, field values and Google data are unchanged.

- forms.css owns the presentation of session/group/future-event forms and existing reviews.
- Three static forms gain only a pm-form-body wrapper; all fields remain in their original form,
  order, IDs and bindings. A noninteractive Horario e importe label separates the session fields.
- Header and submit area stay outside the scrolling fields. Submit targets are 56 px.
  Mobile uses a bottom sheet and safe-area padding; desktop uses a centered 600 px form.
- Root native reviews and protected-review retain their content and actions; mobile uses the full
  width, 52 px or larger actions, legible decisions and internal scrolling. Background scrolling
  is locked while a native dialog or the existing protected review is open.
- Realizado uses a neutral pending surface and a success surface when checked. Checked and disabled
  remain controlled exclusively by existing logic. Disabled fields keep readable text and a distinct surface.
- Recurrence, Bolo, Calendar option and location controls share semantic roles and spacing.
- Recovery remains explicit. Drafts are never auto-restored or submitted by this presentation.
- Location fallback, disabled controls, error messages and confirmation semantics are preserved.
- map-picker.js changes only 13 existing user-visible strings to repair broken accents.
  phase4-presentation.json records every exact replacement; the integrity guard reverses both
  phase 4 and phase 3 before hashing original source and comparing original DOM contracts.
- Preview server changes only its local static asset allowlist; no API routing or fixture is changed.

Final validation: all 318 existing Node tests pass (3.72 s), including integrity guards. No
implementation-mirroring CSS unit tests were added. Browser checks cover 320x568, 390x844,
412x915, 768x1024, 1280x900 and a short 412x500 viewport. No form/body horizontal overflow;
submit area remains visible, controls retain form ownership, and review actions fit the viewport.
The short viewport verifies available layout height, not a real Android virtual keyboard.
412x915 is a reference for the user's Xiaomi 14T Pro, not physical-device QA.

Synthetic preview workflow checks:
- Manual Realizado preview explicitly reports Calendar unchanged; confirmed only in the fake book,
  then reopened after reload to verify checked and disabled state. No real data was accessed.
- Group tariff review keeps Conservar actual/Usar propuesta and cancels without applying.
- Draft recovered explicitly; manual address transfer stays in the form until save. Reopening
  after discarding the draft retains the original simulated address. Test drafts were discarded.
- Map could not load in this environment; the manual fallback and close/return flow work.
  Live map tile rendering and physical geolocation were not validated or requested.
- Invalid amount is blocked and the warning preserves the form.
- Future import and protected synchronization were previewed and cancelled without applying.
- Screenshots and a self-contained review gallery are stored outside the repository.

No remote push, release version change, deployment, real Detalle/session/Sheets writes, Calendar
operation or Google authentication occurred. Before any later authorized publication, update
existing changed JS cache versions (including map-picker.js) and perform the release checks.
