import { json, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { requireRole } from '$lib/server/authorization';
import { members } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	await requireRole(event, event.params.id, 'owner');
	if (event.params.userId === event.locals.user?.id)
		return json({ error: 'The owner cannot change their own role.' }, { status: 422 });
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	if (body.role !== 'manager' && body.role !== 'member')
		return json({ error: 'Role must be manager or member.' }, { status: 422 });
	const db = getDatabase(event);
	const result = await db
		.update(members)
		.set({ role: body.role })
		.where(and(eq(members.projectId, event.params.id), eq(members.userId, event.params.userId)));
	if (!result.success) throw error(404, 'Project member not found.');
	return json({ ok: true });
};
