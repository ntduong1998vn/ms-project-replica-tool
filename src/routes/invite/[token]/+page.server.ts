import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getAuth, getDatabase } from '$lib/server/platform';
import { invites, members, projects } from '$lib/server/db/schema';
import { newId } from '$lib/server/ids';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDatabase(event);
	const [row] = await db
		.select({ invite: invites, projectName: projects.name })
		.from(invites)
		.innerJoin(projects, eq(invites.projectId, projects.id))
		.where(eq(invites.token, event.params.token))
		.limit(1);
	return {
		invite:
			row && !row.invite.usedAt && row.invite.expiresAt.getTime() > Date.now()
				? { projectName: row.projectName, role: row.invite.role }
				: null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const session = await getAuth(event).api.getSession({ headers: event.request.headers });
		if (!session?.user)
			throw redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
		const db = getDatabase(event);
		const [row] = await db
			.select({ invite: invites, projectName: projects.name })
			.from(invites)
			.innerJoin(projects, eq(invites.projectId, projects.id))
			.where(eq(invites.token, event.params.token))
			.limit(1);
		if (!row || row.invite.usedAt || row.invite.expiresAt.getTime() <= Date.now())
			return fail(400, { error: 'This invite link is invalid or has expired.' });
		const existing = await db
			.select()
			.from(members)
			.where(and(eq(members.projectId, row.invite.projectId), eq(members.userId, session.user.id)))
			.limit(1);
		if (!existing.length)
			await db.insert(members).values({
				id: newId(),
				projectId: row.invite.projectId,
				userId: session.user.id,
				role: row.invite.role
			});
		await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, row.invite.id));
		throw redirect(303, `/projects/${row.invite.projectId}`);
	}
};
