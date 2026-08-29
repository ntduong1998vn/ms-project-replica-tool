# Kế hoạch xây dựng web app quản lý dự án kiểu MS Project (Svelte + Cloudflare)

## 1. Kết quả research

### 1.1. Tính năng cốt lõi của MS Project cần mô phỏng
Theo tài liệu chính thức của Microsoft, các khái niệm chính:
- **Gantt Chart** (view mặc định): danh sách task dạng cây (summary task + subtask) bên trái, thanh thời gian + mũi tên phụ thuộc bên phải.
- **Dependencies (liên kết task)**: 4 loại Finish-to-Start (mặc định), Start-to-Start, Finish-to-Finish, Start-to-Finish. Thay đổi task trước → tự đẩy task sau.
- **Scheduling engine**: tính ngày dựa trên project start date, duration, dependencies, constraints, lịch làm việc (working calendar).
- **Resource assignment**: gán người/nhóm vào task, theo tải (workload).
- **Các view**: Task Sheet, Gantt, Resource view; milestones; progress (%).

👉 **Kết luận MVP**: tập trung vào **task + due date + assignee + Gantt + dependency FS**. Không cần làm lại full scheduling engine (auto-leveling, resource overallocation...) — quá lớn và không cần thiết cho nhu cầu "lên task, sắp duedate cho member".

### 1.2. Thư viện Gantt cho Svelte
| Thư viện | Ưu | Nhược |
|---|---|---|
| **SVAR Svelte Gantt** (`@svar-ui/svelte-gantt`) | Viết thuần Svelte 5, MIT, có sẵn: drag-resize task, kéo mũi tên dependency (FS/SS/FF/SF), milestone, cây subtask, timescale zoom. Có demo SvelteKit. | Resource lanes + auto-scheduling là bản PRO (trả phí) |
| `svelte-gantt` (ANovokhmet) | Nhẹ, zero-dep | Ít bảo trì, ít tính năng hơn |
| Tự viết (SVG/Canvas) | Toàn quyền | Rất tốn công, không cần thiết |

👉 **Chọn: SVAR core (MIT, miễn phí)**. Phần auto-scheduling (đẩy ngày theo dependency) ta tự viết 1 scheduler CPM đơn giản ở cả client lẫn server — không cần bản PRO.

### 1.3. Stack deploy Cloudflare
Theo docs chính thức Cloudflare (`developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit`):
- **SvelteKit + `adapter-cloudflare`** chạy trên Workers. Scaffold bằng C3 (`npm create cloudflare@latest`).
- **D1 (SQLite)** làm DB, truy cập qua `event.platform.env.DB` (bindings nằm trong `event.platform`, KHÔNG phải `$env/dynamic/private`). Có guide chính thức "Query D1 from SvelteKit".
- **Drizzle ORM**: nhẹ, zero-dep, hợp serverless, có migration tool.
- Auth: **better-auth** (hỗ trợ Workers + D1 qua `@better-auth/drizzle-adapter` — package `@better-auth/cloudflare` KHÔNG tồn tại). Mặc định hash **scrypt** (không phải Argon2); pin ≥1.7.2 (chứa fix non-blocking scrypt, PR #8685). Email/password + session cookie.
- Không dùng Workers Cron/email — đã chốt không làm nhắc due date (chỉ highlight trong UI).

Tất cả đều nằm trong **free tier** (Workers 100k req/ngày, D1 5GB, đủ cho team nhỏ).

---

## 2. Kiến trúc tổng thể

```
Browser (Svelte 5 SPA + SSR)
 ├─ View Gantt:  SVAR Svelte Gantt
 ├─ View Board:  Kanban (drag-drop bằng @dnd-kit/sortable hoặc tự viết)
 └─ View Table:  danh sách task editable
        │ fetch / actions (SvelteKit form actions + load functions)
        ▼
SvelteKit server routes (chạy trên Cloudflare Workers)
 ├─ Auth: better-auth (session cookie, scrypt mặc định, pin ≥1.7.2)
 ├─ Authorization: role owner/manager/member (ma trận quyền bên dưới)
 └─ Drizzle ORM
        ▼
Cloudflare D1 (SQLite): user/session/account/verification (better-auth) + projects, members, tasks, dependencies, invites, activities
```

### Database schema (draft)
```sql
-- Bảng user/session/account/verification do better-auth TỰ QUẢN (tên số ít, mặc định).
-- KHÔNG tự thiết kế bảng users — FK trỏ về user.id của better-auth.

projects     (id, name, start_date, description, created_by, created_at)
members      (id, project_id, user_id, role)          -- user_id → better-auth user.id; role: owner|manager|member
tasks        (id, project_id, parent_id,              -- cây subtask
              title, description,
              assignee_id,                            -- → user.id (1 assignee/task, quyết định council)
              start_date, due_date, duration_days,
              status,                                 -- todo|in_progress|blocked|done
              priority, progress, milestone, sort_order)
dependencies (id, task_id, predecessor_id, type)      -- FS|SS|FF|SF
invites      (id, project_id, token, role, expires_at) -- link mở + yêu cầu login, không bind email
activities   (id, project_id, user_id, action, payload_json, created_at)

-- Ghi chú: không cần bảng notifications/cron — đã chốt không làm nhắc due date.
-- MVP 1 assignee/task nên KHÔNG cần bảng assignments.
```

### Authorization matrix (bắt buộc enforce ở mọi API mutation)
| Hành động | owner | manager | member |
|---|---|---|---|
| Xem project/task | ✅ | ✅ | ✅ |
| Tạo/sửa task (mọi task trong project) | ✅ | ✅ | ✅ |
| Xoá task của chính mình | ✅ | ✅ | ✅ |
| Gán assignee, mời member | ✅ | ✅ | ❌ |
| Archive project, xoá task người khác | ✅ | ✅ | ❌ |
| Xoá project, đổi role/giáng member | ✅ | ❌ | ❌ |

### Scheduling engine (tự viết, ~200 dòng)
- **Semantics FS chuẩn (một nguồn sự thật duy nhất)**: successor `effective_start = max(manual_start, pred.effective_due + 1)` (lag=0). Milestone (duration=0): `effective_due = effective_start` — KHÔNG dùng công thức chung.
- Forward pass: `effective_due = effective_start + duration − 1` với task thường; cascade theo topo order.
- **Bất biến dữ liệu**: move/resize task luôn giữ `duration_days` đồng bộ với start/due (derive lại sau mỗi edit) — scheduler không bao giờ chạy trên dữ liệu lệch.
- Khi user kéo task trên Gantt hoặc sửa ngày: chạy lại engine, đánh dấu task nào bị "auto-push" (hiện hint, không tự lưu lặng lẽ).
- Working days: MVP tính theo ngày dương lịch; phase 2 thêm lịch T2–T6 + ngày nghỉ.

---

## 3. Roadmap triển khai

### Phase 0 — Setup (0.5–1 ngày)
- `npm create cloudflare@latest` → SvelteKit + adapter-cloudflare + D1.
- Cài Drizzle + schema + migrations (`drizzle-kit generate/migrate`).
- better-auth (≥1.7.2) + `BETTER_AUTH_SECRET`, layout cơ bản, CI deploy: `wrangler deploy` qua GitHub Actions (KHÔNG dùng `wrangler versions upload` — lệnh đó chỉ upload version, không promote production).

### Phase 1 — MVP (~2 tuần)
1. Auth: đăng ký/đăng nhập email+password; verify CPU trên Workers production (scrypt risk, xem Rủi ro 4).
2. CRUD Project; mời member bằng **copy link invite** (link mở + yêu cầu login).
3. CRUD Task trong view **Table**: title, assignee, start/due date, status, priority.
4. **Gantt view** (SVAR, client-only mount): hiển thị theo project, drag move/resize → cập nhật ngày + sync duration, kéo tạo dependency FS, milestone.
5. Gán task cho member; filter "My tasks" + filter theo từng member; highlight task quá hạn.
6. Authorization: enforce ma trận quyền owner/manager/member ở mọi API.
7. Deploy lần đầu lên Cloudflare, gắn domain.

### Phase 2 — Hoàn thiện trải nghiệm (1 tuần)
- **Kanban board** kéo thả theo cột status.
- Subtask (cây task trên Gantt + table).
- Cả 4 loại dependency + scheduler engine đẩy ngày tự động.
- Activity log (ai đổi gì, khi nào).
- Highlight trực quan task sắp/quá hạn ngay trên Gantt + Table (thay cho notification).

### Phase 3 — Nâng cao (tuỳ nhu cầu)
- Real-time sync bằng **Durable Objects** (nhiều người cùng sửa Gantt).
- Working calendar (skip cuối tuần/lễ), hiển thị workload theo member.
- Export CSV.
- Comment + mention trong task.

---

## 4. Ước lượng & rủi ro
| Hạng mục | Ghi chú |
|---|---|
| Chi phí | ~$0 (free tier) + domain |
| Effort MVP | **~2 tuần** dev 1 người (đã điều chỉnh sau council review; chi phí ẩn: tích hợp SVAR + auth trên Workers + scheduler) |
| Rủi ro 1 | SVAR core thiếu tính năng PRO (resource lanes, auto-schedule) → đã có phương án tự viết phần cần thiết |
| Rủi ro 2 | D1 SQLite giới hạn ~5GB & write latency → đủ dùng cho team nhỏ; upgrade lên Postgres (Neon/Hyperdrive) nếu scale |
| Rủi ro 3 | Drag-drop Gantt trên mobile kém → ưu tiên desktop, mobile dùng read-only + board |
| Rủi ro 4 | **scrypt của better-auth có thể vượt CPU time limit Workers** (free tier 10ms CPU) lúc sign-up — lỗi intermittent, KHÔNG tái hiện khi test local (better-auth issue #8860). Mitigation: pin ≥1.7.2 + DoD đăng ký production lặp lại; fallback custom hash `node:crypto.scryptSync` + `nodejs_compat` nếu smoke fail |

## 5. Quyết định đã chốt
1. ✅ Dùng nội bộ team nhỏ (<20 người), invite bằng link — không làm multi-tenant/billing.
2. ✅ Không làm notification/email nhắc hạn — chỉ highlight task sắp/quá hạn trong UI.
3. ✅ Không import từ MS Project — nhập liệu trực tiếp.
4. ✅ **1 assignee/task** (`tasks.assignee_id`), không dùng bảng `assignments` ở MVP (council 2026-08-29).
5. ✅ **Invite link mở + yêu cầu login** — ai có link và đã đăng nhập thì join; không bind email (council 2026-08-29).
6. ✅ **Timeline Phase 1 ~2 tuần**, giữ nguyên scope scheduler FS (council 2026-08-29).
7. ✅ **Hashing: better-auth mặc định ≥1.7.2 + verify production** (đăng ký ≥5 lần không lỗi CPU); chỉ chuyển custom hash nếu smoke fail (council 2026-08-29).

→ Bỏ Workers Cron + email API khỏi scope; stack còn gọn hơn (không cần Resend).

**Bước tiếp theo:** chạy Phase 0 (scaffold SvelteKit + D1 + Drizzle + better-auth).

> 📋 Chi tiết triển khai: xem **`TASKS.md`** — checklist từng sub-task kèm Definition of Done; các sub-task logic (🧪) bắt buộc có unit test pass trước khi tick hoàn thành.
