# DaisyUI UI Refactor Design

## Goal

Refactor the existing SvelteKit interface to Tailwind CSS 4 and daisyUI 5 while preserving every Phase 1 route, interaction, API contract, permission check, and accessibility label.

## Theme

Create one daisyUI custom theme named `ms-project` and make it the application default on the document root. It preserves the existing visual identity instead of adopting a built-in theme.

| daisyUI semantic token | Visual role | Source color |
| --- | --- | --- |
| `base-100`, `base-200`, `base-300` | Sage page and elevated surfaces, subtle boundaries | `#f5f6f2`, lighter/darker sage variants, `#dfe4dd` border family |
| `base-content`, `primary` | Deep green-black text and primary CTA | `#17211b` |
| `secondary`, `success` | Sage actions and safe states | `#5e7666`, `#36513d` |
| `accent` | Terracotta accents, eyebrow and milestone context | `#d95f35` |
| `warning` | Due-today state | Existing yellow-brown family |
| `error` | Error, overdue and destructive states | `#a53e20` |

Use semantic daisyUI colors rather than page-local hex values. Set theme radii to a `0.5rem` field radius and `1rem` box radius; primary call-to-action buttons retain their pill appearance through a shared component utility.

## UI Architecture

Add a single global CSS entry point which imports Tailwind CSS 4, enables daisyUI 5, defines the `ms-project` theme, and contains only app-wide utilities and isolated SVAR Gantt overrides.

Use daisyUI components for repeated interface chrome and Tailwind utilities for responsive layout:

- Landing, login, register, invite: `card`, `fieldset`, `input`, `btn`, and `alert`.
- Project list: cards, toolbar controls, empty states, loading and error states.
- Project detail: action button groups, `tabs`, task creation controls, `table`, deadline/status `badge`, alert/toast feedback, and member list/card layout.
- SVAR Gantt: render inside a daisyUI card but do not apply daisyUI classes to the library-owned DOM. Keep the `.wx-*` selectors isolated and retain the terracotta task-bar duration background and white task text.

Maintain desktop table presentation. On smaller screens, layout actions and task controls may wrap; task tables and Gantt retain horizontal scrolling instead of losing columns or timeline information.

## Migration Constraints

- Do not alter route paths, server actions, API endpoints, request payloads, task update handlers, role checks, user-facing behavior, or existing ARIA labels.
- Remove scoped CSS only when DaisyUI/Tailwind replaces the exact presentation responsibility.
- Do not retain repetitive per-page color, card, button, input, or alert CSS.
- Retain focused custom CSS only where daisyUI cannot represent library-owned SVAR Gantt markup.
- Use the official daisyUI 5 installation and theme configuration format; do not add a deprecated `tailwind.config.js`.

## Acceptance Criteria

1. `ms-project` is the default daisyUI theme and is the source of the interface's core semantic colors.
2. All six UI routes use daisyUI components and Tailwind utilities in place of their repeated scoped presentation CSS.
3. Authentication, invites, project management, task CRUD/filtering, member role changes, and the Table/Gantt switch still work unchanged.
4. Gantt task duration bars visibly retain their terracotta background, border, and readable white labels.
5. `npm run check`, the test suite, and production build pass.
6. Orca CLI browser verification confirms the primary routes load without console errors and the key responsive/table/Gantt states render correctly.
