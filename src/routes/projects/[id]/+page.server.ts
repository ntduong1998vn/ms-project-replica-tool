import { error } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '$lib/server/platform';
import { getMembership } from '$lib/server/authorization';
import { dependencies, members, projects, tasks, user } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await getMembership(event, event.params.id);
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
	const dependencyRows = projectTasks.length
		? await db
				.select()
				.from(dependencies)
				.where(
					inArray(
						dependencies.taskId,
						projectTasks.map((task) => task.id)
					)
				)
		: [];
	const role =
		projectMembers.find((member) => member.userId === event.locals.user!.id)?.role ?? 'member';
	return {
		project: { ...project, role },
		members: projectMembers,
		tasks: projectTasks,
		dependencies: dependencyRows,
		currentUserId: event.locals.user!.id
	};
};
