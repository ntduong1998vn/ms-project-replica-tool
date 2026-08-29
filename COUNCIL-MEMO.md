# COUNCIL MEMO — Review PLAN.md & TASKS.md (MS Project replica)

**Ngày:** 2026-08-29 · **Supervisor:** parent session · **Passes:** 2/2 · **Trạng thái: CONVERGED**

## 1. Câu hỏi & phạm vi
Review `PLAN.md` và `TASKS.md` — kế hoạch xây web app quản lý task kiểu MS Project (SvelteKit + SVAR Svelte Gantt + Cloudflare Workers/D1/Drizzle/better-auth) — tìm vấn đề **kỹ thuật** và **nghiệp vụ** trước khi implement.
Non-goals: không implement, không lật lại 3 quyết định đã chốt (nội bộ <20 người mời bằng link; không notification/cron/email; không import MS Project).

## 2. Khuyến nghị (verdict hợp nhất)
**BLOCK việc chạy Phase 0 cho đến khi patch xong 5 vấn đề P1 bên dưới.** Không cần viết lại plan — chỉ patch tài liệu. Giữ nguyên toàn bộ hướng stack (đã kiểm chứng: `@svar-ui/svelte-gantt@2.7.1` tồn tại, MIT; `adapter-cloudflare`, `wrangler` tồn tại; `@better-auth/cloudflare` KHÔNG tồn tại — D1 đi qua `@better-auth/drizzle-adapter`).

## 3. Danh sách P1 bắt buộc sửa (5)

| # | Vấn đề | Cách sửa |
|---|---|---|
| P1-1 | **Assignee không có chỗ lưu**: kiến trúc PLAN §2 liệt kê bảng `assignments` nhưng SQL không có, `tasks` cũng không có cột assignee — trong khi TASKS 1.4/1.7/2.4 yêu cầu gán/lọc theo assignee. Tính năng lõi "gán member" chưa có storage. | Thêm `tasks.assignee_id` (FK → user) cho MVP 1-assignee; bỏ dòng `assignments` khỏi kiến trúc hoặc viết rõ để Phase 3 |
| P1-2 | **Hai nguồn user mâu thuẫn**: PLAN định nghĩa `users(password_hash)` nhưng better-auth tự quản bảng `user/session/account/verification` (số ít); DoD 0.3 query `FROM user`. FK `members.user_id` không biết trỏ đâu. | Bỏ bảng `users` tự thiết kế; dùng schema mặc định của better-auth; FK `members.user_id → user.id`; sửa PLAN §2 cho nhất quán |
| P1-3 | **Scheduler tự mâu thuẫn**: công thức `due = start + duration − 1` cho milestone (duration=0) ra `due = start−1`, nhưng test trong chính TASKS 1.6 yêu cầu `due = start`. Không có quy ước sync `duration_days` khi move/resize (1.5) → scheduler chạy trên dữ liệu cũ. Ngoài ra lệch semantics FS: PLAN viết `due + lag`, TASKS viết `pred.effective_due + 1`. | Special-case milestone; chuẩn hoá FS một chỗ (lag=0 → successor start = pred.due + 1); thêm DoD ở 1.5: move/resize phải cập nhật `duration_days` (hoặc derive từ start/due) |
| P1-4 | **Trống phân quyền**: role owner/manager/member khai trong schema nhưng không task/DoD nào định nghĩa hay enforce quyền. Member có thể xoá project/invite/sửa task người khác. | Thêm "authorization matrix" vào PLAN + DoD test: member không được xoá project/invite/archive; manager được sửa task mọi người; chỉ owner xoá project |
| P1-5 | **Auth trên Workers — CPU limit (mới, từ Pass 2)**: better-auth mặc định **scrypt** (PLAN viết "Argon2" là sai); issue better-auth #8860: scrypt pure-JS có thể vượt CPU time limit của Workers lúc sign-up (free tier 10ms CPU). Fix upstream #8685 đã merge (better-auth ≥1.7.2) nhưng chỉ "non-blocking", không giảm tổng CPU → rủi ro không tự mất. DoD 0.3 chạy local (miniflare không có CPU limit) nên không phát hiện — chỉ lộ ở production. | Chốt hash strategy ở task 0.3; pin better-auth ≥1.7.2; set `BETTER_AUTH_SECRET` (wrangler secret); thêm DoD production: đăng ký thật trên URL production ≥5 lần liên tiếp, không "exceeded CPU" trong logs, trước khi đóng 0.3 |

## 4. P2 / dọn dẹp tài liệu (sửa cùng đợt, không chặn)
- **CI deploy sai lệnh**: `wrangler versions upload` chỉ upload version, **không** promote production (Cloudflare docs xác nhận) → đổi sang `wrangler deploy`. DoD 0.5 phải verify URL production thực sự phục vụ build mới, không chỉ "workflow xanh". Bonus: dòng `wrangler versions upload --dry-run` ở DoD 0.1 không tồn tại flag → sửa thành `wrangler deploy --dry-run`.
- **D1 binding**: PLAN viết `$env/dynamic/private` — đúng phải là `event.platform.env` (adapter-cloudflare).
- **Cron/Email còn sót** ở PLAN §1.3 + diagram dù §5 đã chốt bỏ → xoá.
- **Mâu thuẫn invite**: PLAN §5 bỏ email provider nhưng TASKS 1.2 vẫn "mời bằng email" → sửa thành invite link (copy link).
- **F3 đã rút**: claim "vite dev không có D1 binding" bị bác — adapter-cloudflare EMULATE `event.platform` trong local dev (SvelteKit docs). Chỉ giữ note: làm rõ DoD 0.2 query D1 **local** chứ không phải production, và scaffold phải dùng `adapter-cloudflare` (không phải adapter-auto).
- **Nghiệp vụ**: thêm filter theo từng member ở 1.7 (manager điều phối due date theo người) — effort nhỏ, giá trị cao.
- **Ước lượng**: Phase 1 điều chỉnh từ 1–1.5 tuần → **~2 tuần** (8–10 ngày làm việc). Tính năng SVAR có sẵn không làm mất chi phí integration (client-only mount/SSR off, mapping sự kiện drag → date-only, persist dependency qua API, scheduler CPM tự viết + 7 case test).
- Task 1.5 nên thêm note: Gantt phải tắt SSR (client-only mount) để tránh hydration mismatch.

## 5. Feedback bị BÁC (kèm lý do)
- **F3 (oracle, Pass 1)**: "DoD 0.2 fail vì vite dev không có D1 binding" → **bác**, hạ xuống note. Bằng chứng: SvelteKit docs chính thức xác nhận `event.platform` được emulate khi dev qua `getPlatformProxy`. Chính oracle tự rút ở Pass 2 (CL-1: refine).
- **Risk "SVAR free thiếu tính năng làm vỡ Phase 2" (reviewer)** → **loại**. Bằng chứng SVAR docs chính thức: bản MIT core có đủ dependencies 4 loại FS/SS/FF/SF, drag & drop + kéo tạo dependency, milestones, cây subtask, timescale. PRO chỉ gồm resource lanes, auto-scheduling, critical path, baselines — không đụng scope Phase 1–2 (auto-scheduling ta tự viết CPM). Reviewer chấp nhận rút ở Pass 2 (CR-1).

## 6. Owner decisions — ✅ ĐÃ CHỐT (2026-08-29)
1. **Assignee**: ✅ **1 assignee/task** → thêm `tasks.assignee_id` (FK → user), bỏ tham chiếu bảng `assignments` khỏi kiến trúc.
2. **Invite link**: ✅ **Link mở + yêu cầu login** (ai có link và đã đăng nhập là join) → sửa TASKS 1.2 bỏ "mời bằng email", bỏ cột `invites.email` hoặc giữ nullable.
3. **Timeline**: ✅ **Chấp nhận ~2 tuần cho Phase 1**, giữ nguyên scope scheduler FS.
4. **Hash strategy**: ✅ **better-auth mặc định ≥1.7.2 + DoD verify production** (đăng ký ≥5 lần không lỗi CPU); chỉ chuyển custom hash nếu smoke production thất bại.

## 7. Điều gì sẽ thay đổi quyết định này
- Prototype đầu Phase 1 chứng minh tích hợp SVAR + auth trên Workers xong < 3 ngày → ước lượng quay về ~1.5 tuần.
- Smoke production cho thấy scrypt ≥1.7.2 không chạm CPU limit sau ≥5 lần đăng ký → DoD CPU ở P1-5 có thể nới.
- SVAR demo chính thức phủ nhận tính năng core nào đó (đã verify qua docs, xác suất thấp) → phần đó chuyển sang tự viết, effort Phase 2 tăng.

## 8. Quy trình council
- **Roster (fallback — không có profile `council-*` nào)**: `oracle` (builtin, **context-aware, forked từ parent session**) + `reviewer` (builtin, resolved context: fresh). Cả hai model qwen3.8-max, thinking high. Không có chair, không peer chat, không chia sẻ transcript; toàn bộ trao đổi chéo qua challenge packet do supervisor biên tập.
- **Pass 1** (workflow `febf8614`): báo cáo độc lập — oracle run `0f954325`, reviewer run `9ce1e32d`. Kết quả: 2/2 verdict BLOCK, 9 điểm đồng thuận độc lập.
- **Pass 2** (workflow `ba0a0977`): cross-exam 5 claims — oracle run `ebb8a8ff` (rút F3, xác nhận F4, thêm risk F9/scrypt), reviewer run `c1e9879a` (đóng giả định SVAR, nâng scrypt lên P1, chỉnh ước lượng ~2 tuần).
- **Evidence supervisor tự kiểm chứng**: Cloudflare docs (versions upload ≠ deploy), SvelteKit docs (platform emulation khi dev), better-auth docs/issue #8860 + PR #8685 (scrypt, CPU limit, fix merged), SVAR docs (feature-gating core vs PRO), npm registry.
- **Confidence**: **cao** với 5 P1 (cả hai advisor độc lập + supervisor verify); **trung bình** với ước lượng effort (kinh nghiệm, chưa có dữ liệu velocity).
