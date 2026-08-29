import { json, error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { members, projects } from '$lib/server/db/schema';
import { newId } from '$lib/server/ids';
import { parseDate } from '$lib/utils/date';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'You must be signed in.');
	const db = getDatabase(event);
	const rows = await db
		.select({ project: projects, role: members.role })
		.from(members)
		.innerJoin(projects, eq(members.projectId, projects.id))
		.where(eq(members.userId, event.locals.user.id))
		.orderBy(asc(projects.name));
	return json(rows.map(({ project, role }) => ({ ...project, role })));
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) throw error(401, 'You must be signed in.');
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const startDate = typeof body.startDate === 'string' ? body.startDate : '';
	if (!name) return json({ error: 'Project name is required.' }, { status: 422 });
	if (name.length > 160)
		return json({ error: 'Project name must be 160 characters or fewer.' }, { status: 422 });
	try {
		parseDate(startDate);
	} catch {
		return json({ error: 'A valid start date is required.' }, { status: 422 });
	}
	const db = getDatabase(event);
	const projectId = newId();
	const now = new Date();
	await db.insert(projects).values({
		id: projectId,
		name,
		startDate,
		description: typeof body.description === 'string' ? body.description.trim() || null : null,
		createdBy: event.locals.user.id,
		createdAt: now
	});
	await db
		.insert(members)
		.values({ id: newId(), projectId, userId: event.locals.user.id, role: 'owner' });
	return json({ id: projectId }, { status: 201 });
};
