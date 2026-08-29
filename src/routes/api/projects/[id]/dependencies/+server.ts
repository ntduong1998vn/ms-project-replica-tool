import { json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { requireRole } from '$lib/server/authorization';
import { dependencies, tasks } from '$lib/server/db/schema';
import { newId } from '$lib/server/ids';
import { validateDeps } from '$lib/domain/scheduler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	await requireRole(event, event.params.id, 'manager');
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	const taskId = String(body.taskId ?? '');
	const predecessorId = String(body.predecessorId ?? '');
	const type = body.type === 'FS' ? 'FS' : body.type;
	if (!taskId || !predecessorId || taskId === predecessorId || type !== 'FS')
		return json(
			{ error: 'Only non-self FS dependencies are supported in Phase 1.' },
			{ status: 422 }
		);
	const db = getDatabase(event);
	const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, event.params.id));
	if (
		!projectTasks.some((task) => task.id === taskId) ||
		!projectTasks.some((task) => task.id === predecessorId)
	)
		return json({ error: 'Both tasks must belong to this project.' }, { status: 422 });
	const existing = await db
		.select()
		.from(dependencies)
		.where(and(eq(dependencies.taskId, taskId), eq(dependencies.predecessorId, predecessorId)))
		.limit(1);
	if (existing.length) return json({ error: 'Dependency already exists.' }, { status: 409 });
	const currentDependencies = await db
		.select()
		.from(dependencies)
		.where(
			inArray(
				dependencies.taskId,
				projectTasks.map((task) => task.id)
			)
		);
	const proposed = [
		...currentDependencies.map((dep) => ({
			task_id: dep.taskId,
			predecessor_id: dep.predecessorId,
			type: dep.type
		})),
		{ task_id: taskId, predecessor_id: predecessorId, type: 'FS' as const }
	];
	const check = validateDeps(
		projectTasks.map((task) => ({
			id: task.id,
			start_date: task.startDate,
			due_date: task.dueDate,
			duration_days: task.durationDays,
			milestone: task.milestone
		})),
		proposed
	);
	if (!check.valid)
		return json(
			{ error: `Dependency would create a cycle: ${check.cycles[0]?.join(' → ')}` },
			{ status: 422 }
		);
	await db.insert(dependencies).values({ id: newId(), taskId, predecessorId, type: 'FS' });
	return json({ ok: true }, { status: 201 });
};
