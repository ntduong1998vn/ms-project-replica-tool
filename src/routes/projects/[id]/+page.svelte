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

<main class="mx-auto max-w-[1400px] px-4 py-6 pb-20 sm:px-[4vw] sm:py-10">
	<header class="mb-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<a class="link link-hover text-sm text-base-content/60" href="/projects">← All projects</a>
			<p class="mt-6 mb-3 text-xs font-extrabold tracking-[0.16em] text-accent uppercase">
				{data.project.role} workspace
			</p>
			<h1 class="text-4xl leading-none font-bold tracking-[-0.08em] sm:text-6xl">
				{data.project.name}
			</h1>
			<p class="mt-3 text-base-content/60">
				Project starts {data.project.startDate} · {tasks.length} tasks
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<select class="select border-base-300 select-sm" bind:value={inviteRole} aria-label="Invite role"
				><option value="member">Member invite</option><option value="manager">Manager invite</option
				></select
			><button class="btn btn-secondary btn-pill" onclick={createInvite}>Copy invite link</button
			>{#if data.project.role !== 'member'}<button class="btn btn-ghost btn-sm" onclick={renameProject}
					>Rename</button
				><button class="btn btn-ghost btn-sm" onclick={archiveProject}>Archive</button
				>{/if}{#if data.project.role === 'owner'}<button
					class="btn btn-error btn-ghost btn-sm"
					onclick={deleteProject}>Delete</button
				>{/if}
		</div>
	</header>
	{#if inviteUrl}<div class="alert alert-info alert-soft mb-4 break-all">{inviteUrl}</div>{/if}
	{#if notice}<div class="alert alert-success alert-soft mb-4" role="status">{notice}</div>{/if}
	{#if errorMessage}<div class="alert alert-error alert-soft mb-4" role="alert">{errorMessage}</div>{/if}

	<section class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div role="tablist" class="tabs tabs-box">
			<button role="tab" class:tab-active={view === 'table'} class="tab" onclick={() => (view = 'table')}
				>Table</button
			><button role="tab" class:tab-active={view === 'gantt'} class="tab" onclick={() => (view = 'gantt')}
				>Gantt</button
			>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm text-base-content/60">Show</span><select
				class="select border-base-300 select-sm"
				bind:value={filter}
				aria-label="Task filter"
				><option value="all">All tasks</option><option value="mine">My tasks</option
				>{#each data.members as member}<option value={member.userId}>{member.name}</option
					>{/each}</select
			>
		</div>
	</section>

	<section class="card card-border mb-4 bg-base-100 shadow-md">
		<div class="card-body flex flex-wrap items-center gap-3 p-3">
			<input
				class="input border-base-300 min-w-[250px] flex-[2_1_250px]"
				bind:value={title}
				placeholder="Add a task…"
				aria-label="New task title"
				onkeydown={(event) => event.key === 'Enter' && createTask()}
			/>
			<input
				class="input border-base-300 min-w-[130px] flex-1"
				type="date"
				bind:value={startDate}
				aria-label="New task start date"
			/><input
				class="input border-base-300 min-w-[130px] flex-1"
				type="date"
				bind:value={dueDate}
				aria-label="New task due date"
			/>
			<select
				class="select border-base-300 min-w-[130px] flex-1"
				bind:value={assigneeId}
				aria-label="New task assignee"
			><option value="">Unassigned</option>{#each data.members as member}<option
					value={member.userId}>{member.name}</option
				>{/each}</select
		>
			<select
				class="select border-base-300 min-w-[130px] flex-1"
				bind:value={priority}
				aria-label="New task priority"
			><option value="low">Low</option><option value="medium">Medium</option><option value="high"
				>High</option
			><option value="urgent">Urgent</option></select
		>
			<button class="btn btn-primary btn-pill" onclick={createTask} disabled={saving}>Add task</button>
		</div>
	</section>

	{#if view === 'table'}
		<section class="card card-border bg-base-100 shadow-md">
			<div class="overflow-x-auto">
				<table class="table table-md min-w-[900px]">
					<thead
						><tr
							><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Start</th><th>Due</th
							><th></th></tr
						></thead
					>
					<tbody
						>{#each visibleTasks() as task}
							<tr class:border-l-4={isOverdue(task)} class:border-error={isOverdue(task)}
							><td
								><input
									class="input input-ghost w-full font-bold focus:border-base-300"
									value={task.title}
									onchange={(event) => updateTask(task.id, { title: event.currentTarget.value })}
								/>{#if task.milestone}<span class="badge badge-accent badge-soft badge-sm"
									>◆ milestone</span
								>{/if}</td
							>
							<td
								><select
									class="select select-ghost w-full focus:border-base-300"
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
									class="select select-ghost w-full focus:border-base-300"
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
									class="select select-ghost w-full focus:border-base-300"
									value={task.priority}
									onchange={(event) => updateTask(task.id, { priority: event.currentTarget.value })}
									><option value="low">Low</option><option value="medium">Medium</option><option
										value="high">High</option
									><option value="urgent">Urgent</option></select
								></td
							>
							<td
								><input
									class="input input-ghost w-full focus:border-base-300"
									type="date"
									value={task.startDate ?? ''}
									onchange={(event) =>
										updateTask(task.id, { startDate: event.currentTarget.value || null })}
								/></td
							>
							<td
								><input
									class="input input-ghost w-full focus:border-base-300"
									type="date"
									value={task.dueDate ?? ''}
									onchange={(event) =>
										updateTask(task.id, { dueDate: event.currentTarget.value || null })}
								/>{#if isOverdue(task)}<span class="badge badge-error badge-soft badge-sm">Overdue</span
									>{:else if task.dueDate === today}<span class="badge badge-warning badge-soft badge-sm"
										>Due today</span
									>{/if}</td
							>
							<td
								><button
									class="btn btn-error btn-ghost btn-sm btn-square"
									aria-label={`Delete ${task.title}`}
									onclick={() => deleteTask(task)}>×</button
								></td
							></tr
						>
					{:else}<tr><td colspan="7" class="py-12 text-center text-base-content/60"
							>No tasks match this filter.</td
						></tr
						>{/each}</tbody
				>
			</table>
			</div>
		</section>
	{:else}
		<section class="card card-border overflow-hidden bg-base-100 shadow-md">
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
			{:else}<p class="py-12 text-center text-base-content/60">Loading Gantt…</p>{/if}
			<p class="m-4 text-sm text-base-content/60">
				SVAR Gantt is client-only to avoid SSR hydration mismatch. Move/resize a bar to preview and
				confirm a date change; dependency links are FS in Phase 1.
			</p>
		</section>
	{/if}

	<section class="card card-border mt-4 bg-base-100 shadow-md">
		<div class="card-body grid gap-4 p-5 lg:grid-cols-[220px_1fr]">
			<div>
				<p class="mb-2 text-xs font-extrabold tracking-[0.16em] text-accent uppercase">TEAM</p>
				<h2 class="text-xl font-bold">{data.members.length} project members</h2>
			</div>
			<div class="grid gap-2">
				{#each data.members as member}<div
						class="flex items-center justify-between gap-3 border-b border-base-300 py-2"
					>
						<div><strong>{member.name}</strong><small class="mt-1 block text-xs text-base-content/60"
								>{member.email}</small
							></div>
						<div class="flex items-center gap-2">
							<span class="badge badge-secondary badge-soft badge-sm">{member.role}</span
						>{#if data.project.role === 'owner' && member.role !== 'owner'}<select
									class="select border-base-300 select-sm"
									value={member.role}
									aria-label={`Role for ${member.name}`}
								onchange={(event) => changeRole(member.userId, event.currentTarget.value)}
									><option value="member">Member</option><option value="manager">Manager</option
									></select
							>{/if}
						</div>
					</div>{/each}
			</div>
		</div>
	</section>
</main>
