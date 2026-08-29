<script lang="ts">
	import { computeSchedule } from '$lib/domain/scheduler';
	import { formatDate, parseDate } from '$lib/utils/date';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	let { data } = $props();
	let tasks = $state([] as typeof data.tasks);
	let view = $state<'table' | 'gantt'>('table');
	let filter = $state('all');
	let title = $state('');
	let startDate = $state('');
	let dueDate = $state('');
	let priority = $state('medium');
	let assigneeId = $state('');
	let inviteRole = $state('member');
	let inviteUrl = $state('');
	let notice = $state('');
	let errorMessage = $state('');
	let saving = $state(false);
	let GanttComponent = $state<Component | null>(null);

	$effect(() => {
		tasks = data.tasks;
		startDate = data.project.startDate;
		dueDate = data.project.startDate;
	});

	onMount(async () => {
		GanttComponent = (await import('@svar-ui/svelte-gantt')).Gantt;
	});

	const today = new Date().toISOString().slice(0, 10);
	const visibleTasks = () =>
		tasks.filter(
			(task) =>
				filter === 'all' ||
				(filter === 'mine' && task.assigneeId === data.currentUserId) ||
				task.assigneeId === filter
		);
	const scheduledTasks = () =>
		computeSchedule(
			tasks.map((task) => ({
				id: task.id,
				start_date: task.startDate,
				due_date: task.dueDate,
				duration_days: task.durationDays,
				milestone: task.milestone
			})),
			data.dependencies.map((dependency) => ({
				task_id: dependency.taskId,
				predecessor_id: dependency.predecessorId,
				type: dependency.type
			})),
			data.project.startDate
		);
	const scheduledFor = (task: (typeof tasks)[number]) =>
		scheduledTasks().find((scheduled) => scheduled.id === task.id);
	const minDate = () =>
		visibleTasks()
			.map(
				(task) => scheduledFor(task)?.effective_start ?? task.startDate ?? data.project.startDate
			)
			.sort()[0] ?? data.project.startDate;
	const maxDate = () =>
		visibleTasks()
			.map(
				(task) =>
					scheduledFor(task)?.effective_due ??
					task.dueDate ??
					task.startDate ??
					data.project.startDate
			)
			.sort()
			.at(-1) ?? data.project.startDate;
	const isOverdue = (task: (typeof tasks)[number]) =>
		Boolean(task.dueDate && task.dueDate < today && task.status !== 'done');
	const ganttTasks = () =>
		visibleTasks().map((task) => ({
			id: task.id,
			parent: task.parentId ?? 0,
			text: task.title,
			start: parseDate(
				scheduledFor(task)?.effective_start ?? task.startDate ?? data.project.startDate
			),
			end: parseDate(
				scheduledFor(task)?.effective_due ??
					task.dueDate ??
					task.startDate ??
					data.project.startDate
			),
			duration: scheduledFor(task)?.duration_days ?? task.durationDays,
			progress: task.progress,
			type: task.milestone ? 'milestone' : 'task'
		}));
	const ganttLinks = () =>
		data.dependencies.map((dependency) => ({
			id: dependency.id,
			source: dependency.predecessorId,
			target: dependency.taskId,
			type: 'e2s' as const
		}));

	async function createTask() {
		if (!title.trim()) {
			errorMessage = 'Task title is required.';
			return;
		}
		saving = true;
		errorMessage = '';
		const response = await fetch(`/api/projects/${data.project.id}/tasks`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ title, startDate, dueDate, priority, assigneeId: assigneeId || null })
		});
		if (!response.ok) {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not create task.';
			saving = false;
			return;
		}
		window.location.reload();
	}

	async function updateTask(id: string, patch: Record<string, unknown>) {
		const response = await fetch(`/api/projects/${data.project.id}/tasks/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!response.ok) {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not update task.';
			return;
		}
		window.location.reload();
	}

	async function deleteTask(task: (typeof tasks)[number]) {
		if (!confirm(`Delete “${task.title}”?`)) return;
		const response = await fetch(`/api/projects/${data.project.id}/tasks/${task.id}`, {
			method: 'DELETE'
		});
		if (response.ok) tasks = tasks.filter((item) => item.id !== task.id);
		else {
			const payload = (await response.json()) as { message?: string };
			errorMessage = payload.message ?? 'Could not delete task.';
		}
	}

	async function createInvite() {
		const response = await fetch(`/api/projects/${data.project.id}/invites`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ role: inviteRole })
		});
		if (!response.ok) {
			const payload = (await response.json()) as { message?: string };
			errorMessage = payload.message ?? 'Could not create invite.';
			return;
		}
		const payload = (await response.json()) as { url: string };
		inviteUrl = payload.url;
		await navigator.clipboard?.writeText(inviteUrl);
		notice = 'Invite link copied';
	}

	async function connectTasks(predecessorId: string, taskId: string) {
		if (predecessorId === taskId) return;
		const response = await fetch(`/api/projects/${data.project.id}/dependencies`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ predecessorId, taskId, type: 'FS' })
		});
		if (response.ok) notice = 'Finish-to-start dependency added';
		else {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not add dependency.';
		}
	}

	async function handleGanttTaskUpdate(event: {
		id: string | number;
		task: { start?: Date; end?: Date; type?: string };
	}) {
		const task = tasks.find((item) => item.id === String(event.id));
		if (!task || !event.task.start) return;
		const start = formatDate(event.task.start);
		const due =
			event.task.type === 'milestone' ? start : formatDate(event.task.end ?? event.task.start);
		if (start === task.startDate && due === task.dueDate) return;
		if (!confirm(`Apply the schedule change to “${task.title}”?`)) {
			window.location.reload();
			return;
		}
		await updateTask(task.id, { startDate: start, dueDate: due });
	}

	async function handleGanttLink(event: {
		link: { source?: string | number; target?: string | number; type?: string };
	}) {
		if (!event.link.source || !event.link.target || event.link.type !== 'e2s') return;
		if (!confirm('Create this finish-to-start dependency?')) {
			window.location.reload();
			return;
		}
		await connectTasks(String(event.link.source), String(event.link.target));
	}

	async function renameProject() {
		const nextName = prompt('Project name', data.project.name)?.trim();
		if (!nextName || nextName === data.project.name) return;
		const response = await fetch(`/api/projects/${data.project.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: nextName })
		});
		if (response.ok) window.location.reload();
		else {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not rename project.';
		}
	}

	async function archiveProject() {
		if (!confirm('Archive this project?')) return;
		const response = await fetch(`/api/projects/${data.project.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ archived: true })
		});
		if (response.ok) window.location.reload();
		else {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not archive project.';
		}
	}

	async function deleteProject() {
		if (!confirm('Delete this project and all its tasks?')) return;
		const response = await fetch(`/api/projects/${data.project.id}`, { method: 'DELETE' });
		if (response.ok) window.location.href = '/projects';
		else {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not delete project.';
		}
	}

	async function changeRole(userId: string, role: string) {
		const response = await fetch(`/api/projects/${data.project.id}/members/${userId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ role })
		});
		if (!response.ok) {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not change role.';
		} else window.location.reload();
	}
</script>

<svelte:head><title>{data.project.name} · MS Project Replica</title></svelte:head>

<main class="workspace">
	<header class="workspace-head">
		<div>
			<a class="back" href="/projects">← All projects</a>
			<p class="eyebrow">{data.project.role} workspace</p>
			<h1>{data.project.name}</h1>
			<p class="muted">Project starts {data.project.startDate} · {tasks.length} tasks</p>
		</div>
		<div class="head-actions">
			<select bind:value={inviteRole} aria-label="Invite role"
				><option value="member">Member invite</option><option value="manager">Manager invite</option
				></select
			><button class="secondary" onclick={createInvite}>Copy invite link</button
			>{#if data.project.role !== 'member'}<button class="quiet" onclick={renameProject}
					>Rename</button
				><button class="quiet" onclick={archiveProject}>Archive</button
				>{/if}{#if data.project.role === 'owner'}<button
					class="danger-button"
					onclick={deleteProject}>Delete</button
				>{/if}
		</div>
	</header>
	{#if inviteUrl}<p class="invite-result">{inviteUrl}</p>{/if}
	{#if notice}<div class="toast" role="status">{notice}</div>{/if}
	{#if errorMessage}<div class="error" role="alert">{errorMessage}</div>{/if}

	<section class="toolbar">
		<div class="tabs">
			<button class:active={view === 'table'} onclick={() => (view = 'table')}>Table</button><button
				class:active={view === 'gantt'}
				onclick={() => (view = 'gantt')}>Gantt</button
			>
		</div>
		<div class="filters">
			<span>Show</span><select bind:value={filter} aria-label="Task filter"
				><option value="all">All tasks</option><option value="mine">My tasks</option
				>{#each data.members as member}<option value={member.userId}>{member.name}</option
					>{/each}</select
			>
		</div>
	</section>

	<section class="card add-task">
		<input
			bind:value={title}
			placeholder="Add a task…"
			aria-label="New task title"
			onkeydown={(event) => event.key === 'Enter' && createTask()}
		/>
		<input type="date" bind:value={startDate} aria-label="New task start date" /><input
			type="date"
			bind:value={dueDate}
			aria-label="New task due date"
		/>
		<select bind:value={assigneeId} aria-label="New task assignee"
			><option value="">Unassigned</option>{#each data.members as member}<option
					value={member.userId}>{member.name}</option
				>{/each}</select
		>
		<select bind:value={priority} aria-label="New task priority"
			><option value="low">Low</option><option value="medium">Medium</option><option value="high"
				>High</option
			><option value="urgent">Urgent</option></select
		>
		<button class="primary" onclick={createTask} disabled={saving}>Add task</button>
	</section>

	{#if view === 'table'}
		<section class="card table-wrap">
			<table>
				<thead
					><tr
						><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Start</th><th>Due</th
						><th></th></tr
					></thead
				>
				<tbody
					>{#each visibleTasks() as task}
						<tr class:overdue={isOverdue(task)}
							><td
								><input
									class="title-input"
									value={task.title}
									onchange={(event) => updateTask(task.id, { title: event.currentTarget.value })}
								/>{#if task.milestone}<span class="milestone-label">◆ milestone</span>{/if}</td
							>
							<td
								><select
									value={task.assigneeId ?? ''}
									onchange={(event) =>
										updateTask(task.id, { assigneeId: event.currentTarget.value || null })}
									><option value="">Unassigned</option>{#each data.members as member}<option
											value={member.userId}>{member.name}</option
										>{/each}</select
								></td
							>
							<td
								><select
									value={task.status}
									onchange={(event) => updateTask(task.id, { status: event.currentTarget.value })}
									><option value="todo">To do</option><option value="in_progress"
										>In progress</option
									><option value="blocked">Blocked</option><option value="done">Done</option
									></select
								></td
							>
							<td
								><select
									value={task.priority}
									onchange={(event) => updateTask(task.id, { priority: event.currentTarget.value })}
									><option value="low">Low</option><option value="medium">Medium</option><option
										value="high">High</option
									><option value="urgent">Urgent</option></select
								></td
							>
							<td
								><input
									type="date"
									value={task.startDate ?? ''}
									onchange={(event) =>
										updateTask(task.id, { startDate: event.currentTarget.value || null })}
								/></td
							>
							<td
								><input
									type="date"
									value={task.dueDate ?? ''}
									onchange={(event) =>
										updateTask(task.id, { dueDate: event.currentTarget.value || null })}
								/>{#if isOverdue(task)}<span class="badge overdue-badge">Overdue</span
									>{:else if task.dueDate === today}<span class="badge today-badge">Due today</span
									>{/if}</td
							>
							<td
								><button
									class="icon-button"
									aria-label={`Delete ${task.title}`}
									onclick={() => deleteTask(task)}>×</button
								></td
							></tr
						>
					{:else}<tr><td colspan="7" class="empty-row">No tasks match this filter.</td></tr
						>{/each}</tbody
				>
			</table>
		</section>
	{:else}
		<section class="card gantt-wrap">
			{#if GanttComponent}
				<div class="svar-gantt">
					<GanttComponent
						tasks={ganttTasks()}
						links={ganttLinks()}
						scales={[
							{ unit: 'month', step: 1, format: '%F %Y' },
							{ unit: 'week', step: 1, format: 'W%W' },
							{ unit: 'day', step: 1, format: '%j' }
						]}
						start={parseDate(minDate())}
						end={parseDate(maxDate())}
						projectStart={parseDate(data.project.startDate)}
						undo={false}
						onupdateTask={handleGanttTaskUpdate}
						onaddLink={handleGanttLink}
					/>
				</div>
			{:else}<p class="empty-row">Loading Gantt…</p>{/if}
			<p class="gantt-help">
				SVAR Gantt is client-only to avoid SSR hydration mismatch. Move/resize a bar to preview and
				confirm a date change; dependency links are FS in Phase 1.
			</p>
		</section>
	{/if}

	<section class="members-panel card">
		<div>
			<p class="eyebrow">TEAM</p>
			<h2>{data.members.length} project members</h2>
		</div>
		<div class="member-list">
			{#each data.members as member}<div class="member-row">
					<div><strong>{member.name}</strong><small>{member.email}</small></div>
					<div class="member-role">
						<span class="role-chip">{member.role}</span
						>{#if data.project.role === 'owner' && member.role !== 'owner'}<select
								value={member.role}
								aria-label={`Role for ${member.name}`}
								onchange={(event) => changeRole(member.userId, event.currentTarget.value)}
								><option value="member">Member</option><option value="manager">Manager</option
								></select
							>{/if}
					</div>
				</div>{/each}
		</div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #f5f6f2;
		color: #17211b;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.workspace {
		margin: 0 auto;
		max-width: 1400px;
		padding: 2.5rem 4vw 5rem;
	}
	.workspace-head {
		align-items: end;
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}
	.back {
		color: #68756b;
		font-size: 0.85rem;
		text-decoration: none;
	}
	.eyebrow {
		color: #d95f35;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		margin: 1.5rem 0 0.7rem;
		text-transform: uppercase;
	}
	h1 {
		font-size: clamp(2.4rem, 6vw, 5.5rem);
		letter-spacing: -0.08em;
		line-height: 0.9;
		margin: 0;
	}
	.muted {
		color: #68756b;
	}
	.head-actions,
	.toolbar,
	.filters,
	.tabs,
	.add-task {
		align-items: center;
		display: flex;
		gap: 0.6rem;
	}
	select,
	input {
		border: 1px solid #ccd5cc;
		border-radius: 0.55rem;
		box-sizing: border-box;
		background: white;
		color: inherit;
		font: inherit;
		padding: 0.62rem 0.65rem;
	}
	.secondary,
	.primary,
	.icon-button,
	.tabs button {
		border: 0;
		cursor: pointer;
		font: inherit;
	}
	.secondary {
		background: #e6eee6;
		border-radius: 999px;
		color: #36513d;
		font-weight: 750;
		padding: 0.75rem 1rem;
	}
	.quiet,
	.danger-button {
		background: transparent;
		border: 0;
		color: #68756b;
		cursor: pointer;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		padding: 0.5rem;
	}
	.danger-button {
		color: #a53e20;
	}
	.primary {
		background: #17211b;
		border-radius: 999px;
		color: #fff;
		font-weight: 750;
		padding: 0.72rem 1rem;
	}
	.primary:disabled {
		opacity: 0.5;
	}
	.invite-result,
	.toast,
	.error {
		border-radius: 0.6rem;
		margin: 0 0 1rem;
		padding: 0.7rem 0.9rem;
	}
	.invite-result,
	.toast {
		background: #e6eee6;
		color: #36513d;
		overflow-wrap: anywhere;
	}
	.error {
		background: #fff0eb;
		color: #a53e20;
	}
	.toolbar {
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.tabs {
		background: #e8ece6;
		border-radius: 999px;
		padding: 0.25rem;
	}
	.tabs button {
		background: transparent;
		border-radius: 999px;
		color: #68756b;
		padding: 0.55rem 0.9rem;
	}
	.tabs button.active {
		background: white;
		color: #17211b;
		font-weight: 750;
	}
	.filters span {
		color: #68756b;
		font-size: 0.85rem;
	}
	.card {
		background: #fff;
		border: 1px solid #dfe4dd;
		border-radius: 1.1rem;
		box-shadow: 0 1rem 3rem #26372b0b;
	}
	.add-task {
		flex-wrap: wrap;
		margin-bottom: 1rem;
		padding: 0.7rem;
	}
	.add-task input:first-child {
		flex: 2 1 250px;
	}
	.add-task input,
	.add-task select {
		flex: 1 1 130px;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		min-width: 900px;
		width: 100%;
	}
	th {
		color: #68756b;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		padding: 1rem 0.8rem 0.7rem;
		text-align: left;
		text-transform: uppercase;
	}
	td {
		border-top: 1px solid #edf0eb;
		padding: 0.7rem 0.8rem;
		vertical-align: middle;
	}
	td input,
	td select {
		border-color: transparent;
		background: transparent;
		padding: 0.45rem;
		width: 100%;
	}
	td input:focus,
	td select:focus {
		background: #f7faf6;
		border-color: #ccd5cc;
		outline: none;
	}
	.title-input {
		font-weight: 700;
		min-width: 180px;
	}
	.milestone-label {
		color: #a05b24;
		display: block;
		font-size: 0.7rem;
		margin: 0.25rem 0.45rem 0;
	}
	.overdue td:first-child {
		box-shadow: inset 3px 0 #cf5d3d;
	}
	.badge {
		border-radius: 999px;
		display: inline-block;
		font-size: 0.65rem;
		font-weight: 800;
		margin-left: 0.35rem;
		padding: 0.2rem 0.4rem;
		white-space: nowrap;
	}
	.overdue-badge {
		background: #fff0eb;
		color: #a53e20;
	}
	.today-badge {
		background: #fff6d9;
		color: #896a16;
	}
	.icon-button {
		background: transparent;
		color: #a53e20;
		font-size: 1.3rem;
		padding: 0.2rem 0.5rem;
	}
	.empty-row {
		color: #68756b;
		padding: 3rem;
		text-align: center;
	}
	.gantt-wrap {
		overflow: hidden;
		padding: 1rem;
	}
	.gantt-help {
		color: #8a958d;
		font-size: 0.78rem;
		margin: 1rem 0.5rem 0.2rem;
	}
	.members-panel {
		display: grid;
		gap: 1rem;
		grid-template-columns: 220px 1fr;
		margin-top: 1rem;
		padding: 1.25rem;
	}
	.members-panel h2 {
		font-size: 1.2rem;
	}
	.members-panel .eyebrow {
		margin: 0 0 0.5rem;
	}
	.member-list {
		display: grid;
		gap: 0.4rem;
	}
	.member-row {
		align-items: center;
		border-bottom: 1px solid #edf0eb;
		display: flex;
		justify-content: space-between;
		padding: 0.45rem 0;
	}
	.member-row small {
		color: #8a958d;
		display: block;
		font-size: 0.75rem;
		margin-top: 0.15rem;
	}
	.member-role {
		align-items: center;
		display: flex;
		gap: 0.5rem;
	}
	.role-chip {
		background: #edf3ed;
		border-radius: 999px;
		color: #5e7666;
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.3rem 0.55rem;
		text-transform: uppercase;
	}
	@media (max-width: 760px) {
		.workspace {
			padding: 1.5rem 1rem 3rem;
		}
		.workspace-head {
			align-items: start;
			flex-direction: column;
		}
		.head-actions {
			flex-wrap: wrap;
		}
	}
	@media (max-width: 760px) {
		.members-panel {
			grid-template-columns: 1fr;
		}
	}
</style>
