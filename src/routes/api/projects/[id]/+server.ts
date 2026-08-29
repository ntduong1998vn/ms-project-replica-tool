import { json, error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { requireProjectMember, requireRole } from '$lib/server/authorization';
import { members, projects, tasks, user } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	await requireProjectMember(event, event.params.id);
	const db = getDatabase(event);
	const [project] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, event.params.id))
		.limit(1);
	if (!project) throw error(404, 'Project not found.');
	const projectMembers = await db
		.select({
			id: members.id,
			userId: members.userId,
			role: members.role,
			name: user.name,
			email: user.email
		})
		.from(members)
		.innerJoin(user, eq(members.userId, user.id))
		.where(eq(members.projectId, project.id))
		.orderBy(asc(user.name));
	const projectTasks = await db
		.select()
		.from(tasks)
		.where(eq(tasks.projectId, project.id))
		.orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
	return json({ project, members: projectMembers, tasks: projectTasks });
};

export const PATCH: RequestHandler = async (event) => {
	await requireRole(event, event.params.id, 'manager');
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	const updates: { name?: string; description?: string | null; archivedAt?: Date | null } = {};
	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || !body.name.trim())
			return json({ error: 'Project name is required.' }, { status: 422 });
		updates.name = body.name.trim();
	}
	if (body.description !== undefined)
		updates.description =
			typeof body.description === 'string' ? body.description.trim() || null : null;
	if (body.archived !== undefined) updates.archivedAt = body.archived ? new Date() : null;
	if (!Object.keys(updates).length) return json({ error: 'No changes supplied.' }, { status: 422 });
	const db = getDatabase(event);
	await db.update(projects).set(updates).where(eq(projects.id, event.params.id));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, event.params.id, 'owner');
	const db = getDatabase(event);
	await db.delete(projects).where(eq(projects.id, event.params.id));
	return new Response(null, { status: 204 });
};
