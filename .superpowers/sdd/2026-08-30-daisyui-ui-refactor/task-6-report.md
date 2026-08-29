# Task 6 report

Replaced all obsolete DaisyUI 5 `input-bordered`, `select-bordered`, `focus:input-bordered`, and `focus:select-bordered` classes in the two project routes. Regular fields retain semantic `border-base-300`; ghost fields use `focus:border-base-300` for the equivalent focus border behavior. No scripts, handlers, API contracts, copy, ARIA, or unrelated files were changed.

## Verification

- `npm run check` — passed; `svelte-check` found 0 errors and 0 warnings. Wrangler also reported an EPERM while writing its user log, but exited successfully.
- `npm run test -- --run` — passed; 4 test files and 19 tests.
- `npx prettier --check "src/routes/projects/+page.svelte" "src/routes/projects/[id]/+page.svelte"` — reports the detail route is not formatted. The same broader formatting drift is present in the pre-cleanup HEAD version, so it was left untouched to avoid unrelated markup changes.
- Targeted search — no obsolete DaisyUI classes remain in either route.
