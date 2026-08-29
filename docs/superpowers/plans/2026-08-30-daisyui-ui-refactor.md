# DaisyUI UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every rendered SvelteKit route to a single custom daisyUI 5 theme while keeping all Phase 1 behaviour unchanged.

**Architecture:** Tailwind CSS 4 and daisyUI 5 are compiled by the Vite plugin and imported once from the root layout. The `ms-project` custom theme owns semantic colour and radius tokens; Svelte routes use daisyUI components plus responsive Tailwind utilities. The SVAR Gantt integration remains library-owned markup with narrowly scoped `.wx-*` overrides in the global stylesheet.

**Tech Stack:** Svelte 5 runes, SvelteKit 2, Vite 8, Tailwind CSS 4, daisyUI 5, `@svar-ui/svelte-gantt`, Vitest, Cloudflare adapter.

**Spec:** `docs/superpowers/specs/2026-08-30-daisyui-ui-refactor-design.md`

## Global Constraints

- Use Tailwind CSS 4 and daisyUI 5; do not create `tailwind.config.js`.
- Define every daisyUI custom-theme variable in the `ms-project` theme; set it as the default light theme.
- Apply `data-theme="ms-project"` to `src/app.html`'s `<html>` element.
- Keep route paths, server actions, API endpoints, request payloads, event handlers, role checks, visible copy, and existing ARIA labels unchanged.
- Replace repeated scoped colour/card/button/input/alert CSS with daisyUI classes and Tailwind utilities.
- Keep SVAR's `.wx-*` selectors global and isolated; task duration bars must retain terracotta fill, border, and white text.
- Browser validation must be performed through Orca CLI, not another browser automation tool.

---

## File Structure

- Create: `src/app.css` — Tailwind import, daisyUI plugin/theme, globally shared typography and only SVAR Gantt overrides.
- Modify: `vite.config.ts` — register `@tailwindcss/vite` next to the existing SvelteKit plugin.
- Modify: `package.json`, `package-lock.json` — add `tailwindcss`, `@tailwindcss/vite`, and `daisyui` development dependencies.
- Modify: `src/app.html` — set the custom theme on the document element.
- Modify: `src/routes/+layout.svelte` — import `src/app.css` once.
- Modify: `src/routes/+page.svelte`, `src/routes/login/+page.svelte`, `src/routes/register/+page.svelte`, `src/routes/invite/[token]/+page.svelte` — convert public/auth surfaces.
- Modify: `src/routes/projects/+page.svelte` — convert project-list controls, cards, and empty state.
- Modify: `src/routes/projects/[id]/+page.svelte` — convert project-workspace chrome, task form/table, feedback, team panel, and remove its Gantt CSS.

No new Svelte component is needed: the existing routes are the established file boundary, and this refactor deliberately avoids moving stateful code into a new abstraction.

### Task 1: Add Tailwind, daisyUI, and the `ms-project` global theme

**Files:**
- Create: `src/app.css`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `src/app.html:2`
- Modify: `src/routes/+layout.svelte:1`

**Interfaces:**
- Consumes: the existing SvelteKit Vite configuration and document template.
- Produces: global Tailwind utilities, daisyUI component CSS, and the default `ms-project` semantic tokens for every route.

- [ ] **Step 1: Install the compile-time styling dependencies**

Run:

```bash
npm install -D tailwindcss@latest @tailwindcss/vite@latest daisyui@latest
```

Expected: `package.json` and `package-lock.json` record all three development dependencies; no production dependency is added.

- [ ] **Step 2: Configure the Vite plugin without changing the existing SvelteKit or Vitest configuration**

Update `vite.config.ts` to import `tailwindcss` from `@tailwindcss/vite` and insert it before `sveltekit(...)`:

```ts
import tailwindcss from '@tailwindcss/vite';

plugins: [
  tailwindcss(),
  sveltekit({ /* retain the existing compilerOptions and adapter */ })
]
```

- [ ] **Step 3: Create the global CSS entry and define all theme variables**

Create `src/app.css` with the required imports, an enabled daisyUI plugin, and a complete theme. Use this exact semantic palette; each `*-content` token must be readable on its paired background:

```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: false;
  logs: false;
}

@plugin "daisyui/theme" {
  name: "ms-project";
  default: true;
  prefersdark: false;
  color-scheme: light;
  --color-base-100: #f5f6f2;
  --color-base-200: #edf0eb;
  --color-base-300: #dfe4dd;
  --color-base-content: #17211b;
  --color-primary: #17211b;
  --color-primary-content: #ffffff;
  --color-secondary: #5e7666;
  --color-secondary-content: #ffffff;
  --color-accent: #d95f35;
  --color-accent-content: #ffffff;
  --color-neutral: #26372b;
  --color-neutral-content: #ffffff;
  --color-info: #3d708f;
  --color-info-content: #ffffff;
  --color-success: #36513d;
  --color-success-content: #ffffff;
  --color-warning: #a05b24;
  --color-warning-content: #ffffff;
  --color-error: #a53e20;
  --color-error-content: #ffffff;
  --radius-selector: 1rem;
  --radius-field: 0.5rem;
  --radius-box: 1rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}

@utility btn-pill {
  @apply rounded-full;
}
```

Then append `body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }` and move the current project-detail `.svar-gantt` and `:global(.svar-gantt .wx-bar...)` declarations into normal global selectors. Preserve the terracotta task bar colours exactly.

- [ ] **Step 4: Mount the CSS and theme at the application root**

Add `data-theme="ms-project"` to `<html lang="en">` in `src/app.html`. Add this import immediately after the existing favicon import in `src/routes/+layout.svelte`:

```ts
import '../app.css';
```

- [ ] **Step 5: Verify the styling pipeline compiles**

Run:

```bash
npm run check
npm run build
```

Expected: both commands exit 0; Svelte recognizes `src/app.css` and Vite processes Tailwind/daisyUI directives.

- [ ] **Step 6: Commit the self-contained foundation**

```bash
git add package.json package-lock.json vite.config.ts src/app.html src/app.css src/routes/+layout.svelte
git commit -m "feat(ui): add DaisyUI project theme"
```

### Task 2: Refactor landing, authentication, and invite routes

**Files:**
- Modify: `src/routes/+page.svelte:6-59`
- Modify: `src/routes/login/+page.svelte:7-145`
- Modify: `src/routes/register/+page.svelte:7-147`
- Modify: `src/routes/invite/[token]/+page.svelte:6-75`

**Interfaces:**
- Consumes: Task 1's root `ms-project` theme and daisyUI classes.
- Produces: public/auth routes that retain their fields, form methods, redirects, validation attributes, and alerts while having no duplicated presentation `<style>` blocks.

- [ ] **Step 1: Convert the landing route to Tailwind layout and a daisyUI CTA**

Keep the existing heading, lede text, and `/projects` link. Replace its custom class/style block with a responsive main such as:

```svelte
<main class="min-h-screen max-w-3xl px-[8vw] py-[16vh]">
  <p class="text-accent text-xs font-extrabold tracking-[0.18em]">PROJECT WORKSPACE</p>
  <h1 class="my-8 text-[clamp(3.5rem,9vw,7.5rem)] leading-[0.9] font-bold tracking-[-0.07em]">
    Plan the work.<br /><span class="text-secondary">See it move.</span>
  </h1>
  <a class="btn btn-primary btn-pill mt-6" href="/projects">Open projects</a>
</main>
```

- [ ] **Step 2: Convert login and registration forms to card/fieldset/input/alert/button components**

Preserve every `name`, `type`, `autocomplete`, `required`, `minlength`, `value`, `method`, and hidden `redirectTo` input. Use a two-column `lg:grid-cols-[minmax(0,1fr)_390px]` shell, a `card card-border bg-base-100 shadow-xl`, and one `fieldset` per label/input pair. Render form errors as:

```svelte
{#if form?.error}
  <div class="alert alert-error alert-soft" role="alert"><span>{form.error}</span></div>
{/if}
```

Give submit buttons `class="btn btn-primary btn-pill mt-2 w-full"`; preserve their exact text. Remove each route's `<style>` block after all layout and visual classes are present.

- [ ] **Step 3: Convert the invite card without altering acceptance behaviour**

Keep the `data.invite` conditional and the `<form method="POST">`. Use a centered `min-h-screen` layout and `card card-border bg-base-100 shadow-xl`; use `alert alert-error alert-soft` for `form?.error` and `btn btn-primary btn-pill` for the accept action. Keep both expired-link text and the invite role `<strong>` unchanged.

- [ ] **Step 4: Typecheck all public/auth markup**

Run:

```bash
npm run check
```

Expected: exit 0, with no warning about Svelte event syntax, form bindings, or unused style selectors.

- [ ] **Step 5: Commit the public route conversion**

```bash
git add src/routes/+page.svelte src/routes/login/+page.svelte src/routes/register/+page.svelte 'src/routes/invite/[token]/+page.svelte'
git commit -m "refactor(ui): convert public routes to DaisyUI"
```

### Task 3: Refactor the projects list screen

**Files:**
- Modify: `src/routes/projects/+page.svelte:1-244`

**Interfaces:**
- Consumes: Task 1's theme and Task 2's shared convention that primary actions use `btn btn-primary btn-pill`.
- Produces: visually consistent project create controls, empty state, and project cards without changing `createProject()` or navigation.

- [ ] **Step 1: Keep the current client state and request contract intact**

Do not alter `showForm`, `name`, `startDate`, `errorMessage`, `saving`, `createProject()`, its `fetch('/api/projects')` URL, POST payload, or success redirect. Modify only the markup class attributes and remove page-local presentation CSS.

- [ ] **Step 2: Convert the header and create form**

Use responsive utilities on the header (`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`). Make New project and Create project use `btn btn-primary btn-pill`; keep disabled binding. Wrap the form in `card card-border bg-base-100 shadow-xl`, use two `fieldset` containers and `input input-bordered w-full`, and replace the inline error paragraph with:

```svelte
{#if errorMessage}
  <div class="alert alert-error alert-soft basis-full" role="alert"><span>{errorMessage}</span></div>
{/if}
```

- [ ] **Step 3: Convert empty and project-card states**

Render the empty state as a `card card-border bg-base-100 shadow-xl` with `card-body items-center text-center`. Render the project grid with `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`. Each project link remains the same `href`, but becomes a `card card-border bg-base-100 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl`; put content in `card-body`. Use `badge badge-secondary badge-soft` for roles and `badge badge-error badge-soft` for archived status. Use `text-accent` for “Open workspace ↗”.

- [ ] **Step 4: Verify type safety and existing domain tests**

Run:

```bash
npm run check
npm run test -- --run
```

Expected: checks exit 0 and all existing Vitest tests pass; no server/domain behavior was modified.

- [ ] **Step 5: Commit the project list conversion**

```bash
git add src/routes/projects/+page.svelte
git commit -m "refactor(ui): convert projects list to DaisyUI"
```

### Task 4: Refactor project workspace controls, tasks, and members

**Files:**
- Modify: `src/routes/projects/[id]/+page.svelte:264-787`

**Interfaces:**
- Consumes: the Task 1 theme and its global Gantt styles.
- Produces: the existing project workspace behavior rendered by daisyUI components; retains library component props and all task/member request APIs.

- [ ] **Step 1: Preserve workspace logic before altering markup**

Do not change any script declarations or implementations, especially `createInvite`, `renameProject`, `archiveProject`, `deleteProject`, `createTask`, `updateTask`, `deleteTask`, `changeRole`, `visibleTasks`, `ganttTasks`, `ganttLinks`, `handleGanttTaskUpdate`, and `handleGanttLink`.

- [ ] **Step 2: Convert header actions and feedback states**

Make the workspace container responsive with `mx-auto max-w-[1400px] px-4 py-6 pb-20 sm:px-[4vw] sm:py-10`. Retain every action condition and event handler. Use `select select-bordered select-sm` for the invite role; `btn btn-secondary btn-pill` for Copy invite, `btn btn-ghost btn-sm` for Rename/Archive, and `btn btn-error btn-ghost btn-sm` for Delete. Replace feedback markup with `alert alert-success alert-soft`, `alert alert-error alert-soft`, and an `alert alert-info alert-soft` for the copied URL, retaining `role="status"`, `role="alert"`, and `overflow-wrap:anywhere` via `break-all`.

- [ ] **Step 3: Convert the view switch and task-create controls**

Use the documented button-tab pattern without changing `view`:

```svelte
<div role="tablist" class="tabs tabs-box">
  <button role="tab" class:tab-active={view === 'table'} class="tab" onclick={() => (view = 'table')}>Table</button>
  <button role="tab" class:tab-active={view === 'gantt'} class="tab" onclick={() => (view = 'gantt')}>Gantt</button>
</div>
```

Place the task creator in `card card-border bg-base-100 shadow-md`, use `input input-bordered`, `select select-bordered`, and `btn btn-primary btn-pill`. Retain date bindings, enter-to-create behavior, all `aria-label` values, `disabled={saving}`, and every option value.

- [ ] **Step 4: Convert the task table and deadline/milestone status**

Wrap the existing table in `overflow-x-auto` and apply `class="table table-md min-w-[900px]"`. Preserve all column order, input/change handlers, select values, and delete handler. Use `input input-ghost w-full font-bold focus:input-bordered` for task titles and `select select-ghost w-full focus:select-bordered` for cells. Use `badge badge-accent badge-soft badge-sm` for milestones, `badge badge-error badge-soft badge-sm` for overdue, and `badge badge-warning badge-soft badge-sm` for due today. Represent the overdue row edge with `border-l-4 border-error` on the `<tr>` or its first data cell; do not delete conditional overdue computation.

- [ ] **Step 5: Convert the team panel and remove replaced CSS**

Render the member panel as a responsive `card card-border bg-base-100 shadow-md` with a `grid gap-4 lg:grid-cols-[220px_1fr]` body. Use `badge badge-secondary badge-soft badge-sm` for roles and `select select-bordered select-sm` for owner-only role changes. Keep existing label interpolation and `changeRole(member.userId, event.currentTarget.value)`. Delete the route's visual `<style>` block except for no rules; Task 5 moves the Gantt overrides to `src/app.css`.

- [ ] **Step 6: Verify workspace compile and regression suite**

Run:

```bash
npm run check
npm run test -- --run
```

Expected: exit 0 and all current tests pass. In particular, no template change modifies data payload types.

- [ ] **Step 7: Commit the workspace shell conversion**

```bash
git add 'src/routes/projects/[id]/+page.svelte'
git commit -m "refactor(ui): convert project workspace to DaisyUI"
```

### Task 5: Validate SVAR Gantt styling and the full browser workflow

**Files:**
- Modify if needed: `src/app.css` — only the isolated `.svar-gantt` and `.wx-*` compatibility overrides.
- Modify if needed: `src/routes/projects/[id]/+page.svelte` — only class names around the Gantt card and help text.

**Interfaces:**
- Consumes: Tasks 1–4 and a running local SvelteKit development server.
- Produces: verified responsive user interface and a Gantt whose third-party DOM retains visible duration bars.

- [ ] **Step 1: Retain the exact Gantt task-duration contract in global CSS**

Confirm `src/app.css` contains these selectors with the same visual properties:

```css
.svar-gantt {
  --wx-gantt-task-color: #d95f35;
  --wx-gantt-task-font-color: #ffffff;
  --wx-gantt-task-border: 1px solid #b94f2d;
  --wx-gantt-task-border-color: #8f351d;
  min-height: 480px;
}

.svar-gantt .wx-bar.wx-task:not(.wx-milestone),
.svar-gantt .wx-bar.wx-task:not(.wx-milestone) > .wx-content {
  background-color: #d95f35;
  color: #ffffff;
}
```

Keep the existing border, radius, font weight, and padding rules from the current page stylesheet. Do not use `:global(...)` in `src/app.css`, because it is already global CSS.

- [ ] **Step 2: Run static and production checks**

Run:

```bash
npm run check
npm run test -- --run
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Start the development server and use Orca CLI to inspect all primary routes**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Using Orca CLI, open `/`, `/login`, `/register`, `/invite/<valid-or-expired-test-token>`, `/projects`, and an existing `/projects/<id>`. Verify page loading and capture console output. Authenticate or use the existing browser state when a protected route requires it. Confirm no console errors.

- [ ] **Step 4: Verify interaction and responsive checkpoints with Orca CLI**

On an existing project workspace, use the browser to: switch Table/Gantt, create or edit a task if fixture data permits, change the member filter, open the invite-role select, and confirm the owner/manager action visibility matches the loaded role. Inspect a non-milestone `.wx-bar.wx-task > .wx-content` computed style; its background must be `rgb(217, 95, 53)` and its text must be white. Resize the viewport to 375px and verify header actions/task controls wrap while the table and Gantt remain horizontally scrollable.

- [ ] **Step 5: Commit final UI validation adjustments**

```bash
git add src/app.css 'src/routes/projects/[id]/+page.svelte'
git commit -m "fix(ui): preserve Gantt task duration styling"
```

Only create this commit if Task 5 changed tracked files. If no change was necessary, record the successful verification in the pull request or task handoff instead of creating an empty commit.
