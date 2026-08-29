import { json } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/platform';
import { requireRole } from '$lib/server/authorization';
import { invites } from '$lib/server/db/schema';
import { newId, newInviteToken } from '$lib/server/ids';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	await requireRole(event, event.params.id, 'manager');
	const body = (await event.request.json().catch(() => ({}))) as Record<string, any>;
	const role = body.role === 'manager' ? 'manager' : 'member';
	const db = getDatabase(event);
	const token = newInviteToken();
	await db.insert(invites).values({
		id: newId(),
		projectId: event.params.id,
		token,
		role,
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
	});
	return json({ token, url: `${event.url.origin}/invite/${token}` }, { status: 201 });
};
