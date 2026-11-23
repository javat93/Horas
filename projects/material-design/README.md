# PercuManager Material foundation phases 1 and 2

Development only. Based on PercuManager 1.7.2 at 91d9b51e6060bbe24960aecef8f639b71df6d659.
Date: 2026-11-23 Europe/Madrid. Branch: feature/material-foundation.
No remote push, production deployment, real Google access or real data writes.

## Phase 1 baseline

baseline.json records 183 source hashes and 224 HTML element contracts (IDs, data attributes,
form field identifiers, types, methods and ARIA attributes), the source commit, version and four viewport sizes.
The material-foundation tests enforce the original HTML after removing the added CSS links.
All existing scripts and application markup remain identical.

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

Phases 3 to 6 are pending: dedicated redesign of screen layouts, additional presentation semantics,
full form/review composition, specialized module refinements and removal of duplicated legacy CSS.
No claims of a completed whole-app redesign or production publication.
Existing workflows, quotas and state semantics remain the reference.

## Before any later publication

Obtain user review of this local result. Update affected pre-existing JS resource cache versions,
run the required checks, and publish only when authorized. Do not deploy this development branch
or turn the isolated preview into a production server.
