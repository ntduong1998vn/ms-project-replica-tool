import { json } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { requireProjectMember } from '$lib/server/authorization';
import { members, tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/ids';
import { normalizeTaskDates, validateTask } from '$lib/domain/task';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	await requireProjectMember(event, event.params.id);
	const db = getDatabase(event);
	const rows = await db
		.select()
		.from(tasks)
		.where(eq(tasks.projectId, event.params.id))
		.orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
	return json(rows);
};

export const POST: RequestHandler = async (event) => {
	const membership = await requireProjectMember(event, event.params.id);
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	if (membership.role === 'member' && body.assigneeId !== undefined && body.assigneeId !== null) {
		return json({ error: 'Members cannot assign tasks.' }, { status: 403 });
	}
	const input = {
		title: typeof body.title === 'string' ? body.title : '',
		start_date: body.startDate ?? null,
		due_date: body.dueDate ?? null,
		duration_days: body.durationDays === undefined ? 1 : Number(body.durationDays),
		status: body.status,
		priority: body.priority
	};
	const validation = validateTask(input);
	if (!validation.valid)
		return json({ error: 'Invalid task.', fields: validation.errors }, { status: 422 });
	const db = getDatabase(event);
	if (body.assigneeId) {
		const [assignee] = await db
			.select()
			.from(members)
			.where(and(eq(members.projectId, event.params.id), eq(members.userId, body.assigneeId)))
			.limit(1);
		if (!assignee) return json({ error: 'Assignee must be a project member.' }, { status: 422 });
	}
	if (body.parentId) {
		const [parent] = await db
			.select({ id: tasks.id })
			.from(tasks)
			.where(and(eq(tasks.id, body.parentId), eq(tasks.projectId, event.params.id)))
			.limit(1);
		if (!parent)
			return json({ error: 'Parent task must belong to this project.' }, { status: 422 });
	}
	const dates = normalizeTaskDates(
		input.start_date,
		input.due_date,
		input.duration_days,
		Boolean(body.milestone)
	);
	const now = new Date();
	const id = newId();
	await db.insert(tasks).values({
		id,
		projectId: event.params.id,
		parentId: body.parentId ?? null,
		title: validation.value.title,
		description: typeof body.description === 'string' ? body.description.trim() || null : null,
		assigneeId: body.assigneeId ?? null,
		startDate: dates.startDate,
		dueDate: dates.dueDate,
		durationDays: dates.durationDays,
		status: (body.status ?? 'todo') as 'todo' | 'in_progress' | 'blocked' | 'done',
		priority: (body.priority ?? 'medium') as 'low' | 'medium' | 'high' | 'urgent',
		progress: Number.isInteger(body.progress) ? Math.max(0, Math.min(100, body.progress)) : 0,
		milestone: Boolean(body.milestone),
		sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder : Date.now(),
		createdAt: now,
		updatedAt: now
	});
	return json({ id }, { status: 201 });
};
