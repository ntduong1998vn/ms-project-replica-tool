# TASKS — Checklist triển khai (kèm Definition of Done)

> **v2 (2026-08-29)** — đã patch theo **`COUNCIL-MEMO.md`** (5 P1: assignee storage, users/user, scheduler self-contradiction, phân quyền, scrypt CPU) + các mục P2.

> **Quy tắc cho agent thực thi:**
> 1. Mỗi sub-task chỉ được tick `[x]` khi **toàn bộ** mục trong khối **DoD** của nó đã được tự verify (chạy lệnh thật, đọc output thật — không được suy đoán).
> 2. Sub-task có nhãn 🧪 **bắt buộc** có unit test; DoD bao gồm câu lệnh test phải pass.
> 3. Trước khi tick, chạy lại: `npm run check && npm run test -- --run && npm run build` (trừ khi sub-task nói rõ là chưa cần).
> 4. Nếu một mục DoD không đạt → không tick, ghi chú blocker và sửa trước.

Ký hiệu: 🧪 = logic cần unit test · ⚙️ = hạ tầng/cấu hình · 🎨 = UI

---

## Phase 0 — Setup nền tảng

### ⚙️ 0.1 Scaffold SvelteKit + Cloudflare adapter
- [ ] Tạo project SvelteKit (Svelte 5, TypeScript) bằng C3, cài `adapter-cloudflare`.
- [ ] `wrangler.jsonc` được commit (kể cả file do tool sinh).

**DoD:**
- [ ] `npm run build` exit code 0, không lỗi adapter.
- [ ] `npm run dev` mở được trang chủ trên localhost.
- [ ] `npx wrangler deploy --dry-run` chạy thành công, detect đúng Workers config. (Lưu ý: `wrangler versions upload` KHÔNG có flag `--dry-run` và cũng không promote production — không dùng.)

### ⚙️ 0.2 D1 database + Drizzle ORM
- [ ] Tạo D1 database (dev local + production), khai báo binding `DB` trong `wrangler.jsonc`; set `migrations_dir: "drizzle"` (drizzle-kit sinh migration vào `drizzle/`, khác default `migrations/` của wrangler).
- [ ] Cài Drizzle + `drizzle.config.ts`; định nghĩa schema: các bảng better-auth mặc định (`user, session, account, verification` — KHÔNG tự thiết kế bảng `users`) + `projects, members, tasks, dependencies, invites, activities`; `tasks` có cột `assignee_id` (FK → `user.id`).
- [ ] Tạo migration đầu tiên và chạy local.

**DoD:**
- [ ] `npx drizzle-kit generate` không lỗi; file migration SQL tồn tại trong `drizzle/`.
- [ ] `npx wrangler d1 migrations apply <db> --local` exit 0.
- [ ] Viết 1 endpoint test `GET /api/health` query `SELECT 1` qua binding D1 (`event.platform.env.DB`, KHÔNG dùng `$env/dynamic/private` cho binding) → trả `{"ok":true}`; verify bằng `curl localhost:5173/api/health` khi `npm run dev` (adapter-cloudflare emulate `event.platform` local qua getPlatformProxy — lưu ý: query D1 **LOCAL**, không phải production).

### ⚙️ 0.3 Better-auth (email/password + session)
- [ ] Cài better-auth **pin ≥1.7.2** (chứa fix non-blocking scrypt #8685), dùng `@better-auth/drizzle-adapter` (package `@better-auth/cloudflare` KHÔNG tồn tại); expose `/api/auth/[...all]`. Mặc định hash là **scrypt** — KHÔNG viết Argon2 vào tài liệu/code.
- [ ] Set `BETTER_AUTH_SECRET`: file `.dev.vars` cho local, `wrangler secret put BETTER_AUTH_SECRET` cho production (ghi vào checklist 1.8).
- [ ] Trang `/login` + `/register` (form SvelteKit actions).
- [ ] Middleware `hooks.server.ts`: bảo vệ mọi route trừ `/login`, `/register`, `/invite/[token]`.

**DoD:**
- [ ] Đăng ký user mới qua UI → có bản ghi trong bảng `user` (tên số ít — bảng mặc định của better-auth; kiểm tra: `npx wrangler d1 execute <db> --local --command "SELECT email FROM user"`).
- [ ] Login thành công → chuyển về `/`, cookie session tồn tại.
- [ ] Truy cập route bảo vệ khi **chưa** login → redirect về `/login` (verify bằng curl: `curl -s -o /dev/null -w '%{http_code}' localhost:5173/projects` trả 3xx).
- [ ] Login sai mật khẩu → hiện lỗi, không tạo session.
- [ ] Ghi chú: scrypt có thể vượt CPU time limit Workers lúc sign-up trên **production** (issue #8860) mà local không tái hiện được → DoD verify CPU nằm ở task **1.9** (đăng ký ≥5 lần trên production). Không đóng Phase 1 khi chưa đạt mục đó.

### 🧪 0.4 Utility ngày tháng (date utils)
- [ ] File `src/lib/utils/date.ts`: `parseDate`, `formatDate`, `addDays`, `daysBetween`, `isOverdue(dueDate, now)`, `startOfWeek/Monday`.
- **Unit test** (`date.test.ts`):
  - `addDays('2025-01-31', 1)` → `'2025-02-01'`
  - `daysBetween` đúng kể cả vắt qua năm nhuận
  - `isOverdue('2025-01-01', 2025-01-02)` → true; đúng ngày due → false (chỉ quá hạn **sau** ngày due)
  - parse/format round-trip không lệch timezone (test với TZ khác nhau nếu được)

**DoD:**
- [ ] `npm run test -- --run src/lib/utils/date.test.ts` pass 100%, coverage các hàm ≥ 95%.
- [ ] Không dùng `new Date(string)` trực tiếp cho date-only (phải parse thủ công hoặc dùng UTC để tránh lệch timezone) — grep xác nhận.

### ⚙️ 0.5 CI/CD GitHub Actions
- [ ] Workflow: push `main` → `npm run check + test + build` → `wrangler deploy` (KHÔNG dùng `wrangler versions upload` — chỉ upload version, không promote production).
- [ ] Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` cấu hình trong repo settings (bước manual — đánh dấu nếu chưa làm được).

**DoD:**
- [ ] Push 1 commit → workflow chạy xanh cả 2 job (check+test, deploy).
- [ ] URL **production** thực sự phục vụ build mới: verify bằng version/asset hash hoặc route health trả git SHA — KHÔNG chỉ dựa vào "workflow xanh".
- [ ] Nếu chưa có quyền cấu hình secret: ghi blocker rõ ràng trong file này, KHÔNG tick mục này.

---

## Phase 1 — MVP

### ⚙️ 1.1 CRUD Project
- [ ] `POST /projects` (tạo), trang `/projects` (list), `/projects/[id]` (chi tiết), rename/archive.
- [ ] Tạo project tự động thêm người tạo làm `owner` vào bảng `members`.

**DoD:**
- [ ] Tạo project qua UI → xuất hiện trong list, bảng `members` có row role=`owner`.
- [ ] User A **không** thấy project của user B (verify: login user B, `curl /projects/<idA>` → 403/404).
- [ ] Form validation: name trống → báo lỗi, không insert DB (verify không có row mới sau submit lỗi).

### ⚙️ 1.2 Mời member (copy link, link mở + yêu cầu login)
- [ ] Nút "Copy invite link" → sinh row `invites` với token ngẫu nhiên ≥ 32 ký tự (KHÔNG gửi email — không có email provider).
- [ ] Trang `/invite/[token]`: bất kỳ user nào đã login mở link đều join được project (link mở, không bind email); chưa login → yêu cầu đăng ký/login rồi join.
- [ ] Token dùng 1 lần, hết hạn sau 7 ngày.

**DoD:**
- [ ] User mới mở link invite → đăng ký → xuất hiện trong project với đúng role.
- [ ] Dùng lại token lần 2 → báo "liên kết không hợp lệ" (verify DB: row invite đã bị xoá/đánh dấu used).
- [ ] Token quá hạn (test bằng cách UPDATE `expires_at` về quá khứ) → từ chối.

### 🧪 1.3 Task domain model + validation
- [ ] Type `Task` + hàm thuần trong `src/lib/domain/task.ts`:
  - `validateTask(input)`: title không trống ≤ 200 ký tự; `due_date >= start_date` nếu có cả hai; status ∈ enum; priority ∈ enum.
  - `buildTaskTree(flatTasks)`: dựng cây từ `parent_id`, trả về forest có sắp xếp theo `sort_order`.
- **Unit test** (`task.test.ts`):
  - due < start → lỗi đúng field
  - status hợp lệ/bất hợp lệ
  - `buildTaskTree`: 6 task hỗn hợp → đúng cây, đúng thứ tự; task con trỏ parent không tồn tại → không crash (bỏ vào root hoặc ném lỗi rõ ràng — quyết định và test đúng hành vi đó)
  - cycle trong `parent_id` (A→B→A) → phát hiện, không đệ quy vô hạn

**DoD:**
- [ ] `npm run test -- --run src/lib/domain/task.test.ts` pass, coverage ≥ 95%.
- [ ] Server routes `/api/projects/[id]/tasks` (POST/PATCH/DELETE) gọi `validateTask` trước khi ghi DB — verify bằng curl payload invalid → 422.

### 🎨 1.4 Table view CRUD task
- [ ] Bảng task trong `/projects/[id]`: thêm nhanh (ô input cuối bảng), inline edit title/assignee/status/due date.
- [ ] Gán `assignee` từ danh sách members của project — lưu vào `tasks.assignee_id` (1 assignee/task).
- [ ] Xoá task có confirm.

**DoD:**
- [ ] Tạo task inline → reload trang vẫn còn (đã persist DB).
- [ ] Sửa due date inline → PATCH được gọi 1 lần, giá trị DB cập nhật đúng (verify qua API hoặc DB query).
- [ ] Assignee không phải member của project → bị từ chối phía server (curl với user_id ngoài project → 422/403).

### 🎨 1.5 Gantt view (SVAR)
- [ ] Tích hợp `@svar-ui/svelte-gantt` tại `/projects/[id]?view=gantt`: render tasks, timescale theo tuần/tháng. **Client-only mount** (tắt SSR cho component này) để tránh hydration mismatch.
- [ ] Kéo thả thanh task (move) → cập nhật `start_date` + `due_date` giữ nguyên duration.
- [ ] Kéo mép thanh (resize) → cập nhật đúng 1 đầu ngày.
- [ ] Sau mọi move/resize: **derive lại `duration_days`** từ start/due và persist cùng PATCH (scheduler 1.6 chạy trên dữ liệu này — cấm để lệch).
- [ ] Render milestone (task `milestone=true`) dạng diamond.

**DoD:**
- [ ] Kéo task sang ngày khác → reload trang, vị trí mới được giữ (verify DB: start/due thay đổi, duration ngày không đổi).
- [ ] Resize đầu trái → chỉ `start_date` đổi; resize đầu phải → chỉ `due_date` đổi; cả 2 trường hợp `duration_days` trong DB khớp với start/due mới.
- [ ] Không lỗi hydration/SSR trong console khi load route Gantt lần đầu.
- [ ] Project 30 task render mượt, không lỗi console; test nhanh với 200 task không treo tab (>2s là blocker cần phân trang/virtualize).

### 🧪 1.6 Dependency FS + Scheduler engine
- [ ] Bảng `dependencies` lưu `(task_id, predecessor_id, type)`; Phase 1 chỉ hỗ trợ `FS`.
- [ ] Kéo từ mép task A sang task B trên Gantt → tạo dependency.
- [ ] `src/lib/domain/scheduler.ts` — hàm thuần (semantics khớp duy nhất với PLAN §2 — `pred.effective_due + 1`, KHÔNG phải `due + lag`):
  ```ts
  computeSchedule(tasks, deps, projectStart): ScheduledTask[]
  // task thường: effective_start = max(own start, max(pred.effective_due) + 1)
  //              effective_due   = effective_start + duration - 1
  // milestone (duration=0): effective_due = effective_start  // special-case, KHÔNG dùng công thức chung
  validateDeps(tasks, deps): { valid, cycles: string[][] }
  ```
- **Unit test** (`scheduler.test.ts`) — tối thiểu các case:
  - Chain A(2 ngày)→B(3 ngày): A due 05/01 thì B start 06/01, due 08/01
  - Hai predecessor: task C nhận ngày của predecessor **muộn hơn**
  - Predecessor bị đẩy → successor tự đẩy theo (cascade ≥ 3 tầng)
  - Successor đã có start **muộn hơn** ngày tính toán → giữ nguyên start của nó (không kéo ngược)
  - Dependency vào milestone (duration 0): due = start
  - `validateDeps`: cycle A→B→C→A → trả về đúng cycle, `computeSchedule` không loop vô hạn (timeout test 2s)
  - Task không có dependency → không đổi ngày

**DoD:**
- [ ] `npm run test -- --run src/lib/domain/scheduler.test.ts` pass 100%.
- [ ] Trên UI: di chuyển predecessor → successor hiện ngày mới (preview) và có confirm trước khi lưu.
- [ ] PATCH tạo dependency gây cycle → server từ chối 422 với message rõ (verify bằng curl).

### 🎨 1.7 Assignee, filter "My tasks" + theo member, highlight quá hạn
- [ ] Filter toggle "My tasks" trên Table + Gantt.
- [ ] Filter **theo từng member** (dropdown) — manager xem tải task của từng người để xếp due date.
- [ ] Task `due_date < today && status != done` → viền đỏ/badge "Overdue"; due hôm nay → badge "Due today".

**DoD:**
- [ ] Seed 3 task (quá hạn, due hôm nay, tương lai) → màu/badge hiển thị đúng cả 3 trạng thái (chụp screenshot hoặc DOM test).
- [ ] Filter "My tasks" của user B không hiện task chỉ assign cho user A; filter theo member X chỉ hiện task của X.
- [ ] Task done dù quá hạn vẫn **không** hiện đỏ — verify bằng test component hoặc DOM query.

### 🛡️ 1.8 Authorization theo role (P1 council)
- [ ] Implement ma trận quyền trong PLAN §2 ở tầng server (helper `requireRole(projectId, minRole)` dùng chung cho mọi mutation API).
- [ ] Áp cho: invite member, gán assignee, archive project, xoá project, xoá/sửa task người khác, đổi role.

**DoD:**
- [ ] Member: gọi API invite/archive/xoá project → 403; sửa task của chính mình → 200.
- [ ] Manager: invite member + xoá task người khác → 200; xoá project → 403.
- [ ] Owner: xoá project, giáng role manager → 200.
- [ ] Toàn bộ case trên có integration test (curl hoặc test API) — không chỉ review code.

### ⚙️ 1.9 Deploy production + domain
- [ ] D1 production DB + chạy migration; `wrangler secret put BETTER_AUTH_SECRET`.
- [ ] Gắn custom domain (nếu có) hoặc dùng `*.workers.dev`.

**DoD:**
- [ ] URL production: đăng ký → tạo project → tạo task → xem Gantt, toàn bộ hoạt động trên data thật.
- [ ] **Auth CPU check (P1 council)**: đăng ký user mới trên URL production **≥5 lần liên tiếp**, kiểm tra Workers logs không có "exceeded CPU time" (scrypt risk, issue #8860). Nếu fail → chuyển custom hash (`node:crypto.scryptSync` + `nodejs_compat` hoặc PBKDF2 Web Crypto) rồi chạy lại check này.
- [ ] `npm run test` local vẫn xanh; không có secret nào nằm trong code (grep `api_token|BETTER_AUTH_SECRET=` trong `src/` → 0 hit; secret chỉ nằm trong `.dev.vars` đã gitignore).

---

## Phase 2 — Hoàn thiện

### 🎨 2.1 Kanban board
- [ ] Board 4 cột theo status, kéo thả đổi cột (dnd), sync PATCH status.
- **DoD:**
  - [ ] Kéo task sang cột khác → reload vẫn giữ status mới (DB đúng).
  - [ ] 2 tab mở cùng project: đổi status ở tab 1, reload tab 2 thấy cập nhật.

### 🧪 2.2 Subtask (task cây)
- [ ] UI indent/outdent task (hoặc nút "add subtask"); Gantt hiển thị summary bar.
- [ ] Dùng lại `buildTaskTree` từ 1.3.
- **Unit test** bổ sung `scheduler.test.ts`:
  - Summary task tự tính start = min(sub start), due = max(sub due)
  - Xoá parent → subtask được promote lên root (hoặc xoá cascade — quyết định + test đúng hành vi)
- **DoD:**
  - [ ] Test mới pass; UI hiển thị đúng cây; không cho phép task làm con của chính descendant của nó (validate + test).

### 🧪 2.3 Đủ 4 loại dependency (SS, FF, SF)
- [ ] Mở rộng `computeSchedule` cho SS/FF/SF:
  - SS: `effective_start = max(..., pred.effective_start)`
  - FF: `effective_due = max(..., pred.effective_due)` → suy ra start
  - SF: successor finish ≥ predecessor start
- **Unit test** bổ sung ≥ 2 case cho mỗi loại + 1 case trộn lẫn FS/FF trong 1 project.
- **DoD:**
  - [ ] `npm run test -- --run` toàn bộ suite xanh.
  - [ ] UI chọn được loại dependency khi kéo mũi tên; ngày preview đúng với test.

### 🧪 2.4 Activity log
- [ ] Ghi log mọi mutation task/member vào bảng `activities` (ai, gì, trước/sau, timestamp).
- [ ] Tab "History" hiển thị log của project.
- **Unit test** (`activity.test.ts`): hàm `diffTask(before, after)` sinh đúng mảng thay đổi (chỉ field đổi, format ngày đọc được).
- **DoD:**
  - [ ] Đổi title + due date 1 task → đúng 2 entry log; đổi assignee → log ghi tên member cũ/mới chứ không phải ID.
  - [ ] Test pass, coverage hàm diff ≥ 95%.

### 🎨 2.5 Undo các thao tác Gantt
- [ ] Toast với nút "Undo" sau mỗi move/resize/tạo dependency (in-memory 1 bước).
- **DoD:**
  - [ ] Kéo task → bấm Undo → DB và UI trả về giá trị cũ (verify bằng giá trị API trước/sau).
  - [ ] Undo chỉ hiệu lực cho thao tác gần nhất, sau reload là mất (đúng spec, không bug).

---

## Phase 3 — Nâng cao (mở khi xong Phase 2)

### ⚙️ 3.1 Real-time sync (Durable Objects)
- **DoD:** 2 trình duyệt cùng mở Gantt, bên A kéo task → bên B cập nhật ≤ 2s không cần reload; test tự động bằng 2 page Playwright.

### 🧪 3.2 Working calendar
- [ ] Skip cuối tuần khi tính duration; config ngày nghỉ theo project.
- **Unit test**: task 3 ngày start Thứ Năm → due Thứ Ba tuần sau; thêm holiday → trượt thêm.
- **DoD:** test pass; Gantt vẫn render theo ngày dương lịch (chỉ duration tính theo ngày làm việc).

### 🎨 3.3 Export CSV
- **DoD:** Export project 50 task → file CSV mở được bằng Excel, đúng cột, UTF-8 BOM để Excel đọc tiếng Việt.

### 🎨 3.4 Comment + mention
- **DoD:** Comment hiển thị theo thứ tự thời gian; `@name` gợi ý đúng danh sách member; user được mention thấy badge khi login.

---

## Checklist tổng trước khi đóng mỗi Phase
- [ ] `npm run check` — 0 lỗi
- [ ] `npm run test -- --run` — toàn bộ xanh
- [ ] `npm run build` — thành công
- [ ] Deploy production hoạt động (smoke test thủ công: đăng nhập → tạo task → xem Gantt)
- [ ] Không còn TODO/FIXME liên quan phase đó: `grep -rn "TODO\|FIXME" src/` — review từng hit
