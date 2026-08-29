import { json, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { getMembership } from '$lib/server/authorization';
import { members, tasks } from '$lib/server/db/schema';
import { normalizeTaskDates, validateTask } from '$lib/domain/task';
import type { RequestHandler } from './$types';

async function getTask(event: Parameters<RequestHandler>[0]) {
	const db = getDatabase(event);
	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, event.params.taskId), eq(tasks.projectId, event.params.id)))
		.limit(1);
	if (!task) throw error(404, 'Task not found.');
	return task;
}

export const PATCH: RequestHandler = async (event) => {
	const membership = await getMembership(event, event.params.id);
	const task = await getTask(event);
	if (membership.role === 'member' && task.assigneeId !== event.locals.user!.id)
		throw error(403, 'Members can only edit their own assigned tasks.');
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	if (membership.role === 'member' && body.assigneeId !== undefined)
		throw error(403, 'Members cannot assign tasks.');
	const next = {
		title: body.title === undefined ? task.title : body.title,
		start_date: body.startDate === undefined ? task.startDate : body.startDate,
		due_date: body.dueDate === undefined ? task.dueDate : body.dueDate,
		duration_days: body.durationDays === undefined ? task.durationDays : Number(body.durationDays),
		status: body.status === undefined ? task.status : body.status,
		priority: body.priority === undefined ? task.priority : body.priority
	};
	const validation = validateTask(next);
	if (!validation.valid)
		return json({ error: 'Invalid task.', fields: validation.errors }, { status: 422 });
	const db = getDatabase(event);
	if (body.assigneeId !== undefined && body.assigneeId !== null) {
		const [assignee] = await db
			.select()
			.from(members)
			.where(and(eq(members.projectId, event.params.id), eq(members.userId, body.assigneeId)))
			.limit(1);
		if (!assignee) return json({ error: 'Assignee must be a project member.' }, { status: 422 });
	}
	const dates = normalizeTaskDates(
		next.start_date,
		next.due_date,
		next.duration_days,
		body.milestone === undefined ? task.milestone : Boolean(body.milestone)
	);
	await db
		.update(tasks)
		.set({
			title: validation.value.title,
			startDate: dates.startDate,
			dueDate: dates.dueDate,
			durationDays: dates.durationDays,
			status: next.status as 'todo' | 'in_progress' | 'blocked' | 'done',
			priority: next.priority as 'low' | 'medium' | 'high' | 'urgent',
			...(body.description !== undefined ? { description: body.description || null } : {}),
			...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId || null } : {}),
			...(body.progress !== undefined
				? { progress: Math.max(0, Math.min(100, Number(body.progress))) }
				: {}),
			updatedAt: new Date()
		})
		.where(and(eq(tasks.id, task.id), eq(tasks.projectId, event.params.id)));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const membership = await getMembership(event, event.params.id);
	const task = await getTask(event);
	if (membership.role === 'member' && task.assigneeId !== event.locals.user!.id)
		throw error(403, 'Members can only delete their own assigned tasks.');
	const db = getDatabase(event);
	await db.delete(tasks).where(eq(tasks.id, task.id));
	return new Response(null, { status: 204 });
};
