import { error, type RequestEvent } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { getDatabase } from './platform';
import { members } from './db/schema';

export type ProjectRole = 'owner' | 'manager' | 'member';
const rank: Record<ProjectRole, number> = { member: 1, manager: 2, owner: 3 };

export async function getMembership(event: RequestEvent, projectId: string) {
	if (!event.locals.user) throw error(401, 'You must be signed in.');
	const db = getDatabase(event);
	const [membership] = await db
		.select()
		.from(members)
		.where(and(eq(members.projectId, projectId), eq(members.userId, event.locals.user.id)))
		.limit(1);
	if (!membership) throw error(403, 'You are not a member of this project.');
	return membership;
}

export async function requireRole(event: RequestEvent, projectId: string, minimum: ProjectRole) {
	const membership = await getMembership(event, projectId);
	if (rank[membership.role as ProjectRole] < rank[minimum])
		throw error(403, 'Insufficient project permissions.');
	return membership;
}

export async function requireProjectMember(event: RequestEvent, projectId: string) {
	return getMembership(event, projectId);
}
