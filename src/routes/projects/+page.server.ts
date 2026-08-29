import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { members, projects } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDatabase(event);
	const rows = await db
		.select({ project: projects, role: members.role })
		.from(members)
		.innerJoin(projects, eq(members.projectId, projects.id))
		.where(eq(members.userId, event.locals.user!.id))
		.orderBy(asc(projects.name));
	return { projects: rows.map(({ project, role }) => ({ ...project, role })) };
};
