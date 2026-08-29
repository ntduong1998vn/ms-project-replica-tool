import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		issuer: text('issuer').notNull(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull()
	},
	(table) => [uniqueIndex('account_issuer_account_idx').on(table.issuer, table.accountId)]
);

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const projects = sqliteTable('projects', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	startDate: text('start_date').notNull(),
	description: text('description'),
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	createdAt: timestamp('created_at').notNull(),
	archivedAt: timestamp('archived_at')
});

export const members = sqliteTable(
	'members',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'manager', 'member'] }).notNull()
	},
	(table) => [uniqueIndex('members_project_user_idx').on(table.projectId, table.userId)]
);

export const tasks = sqliteTable('tasks', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	parentId: text('parent_id').references((): any => tasks.id, { onDelete: 'set null' }),
	title: text('title').notNull(),
	description: text('description'),
	assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
	startDate: text('start_date'),
	dueDate: text('due_date'),
	durationDays: integer('duration_days').notNull().default(1),
	status: text('status', { enum: ['todo', 'in_progress', 'blocked', 'done'] })
		.notNull()
		.default('todo'),
	priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
		.notNull()
		.default('medium'),
	progress: integer('progress').notNull().default(0),
	milestone: integer('milestone', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const dependencies = sqliteTable('dependencies', {
	id: text('id').primaryKey(),
	taskId: text('task_id')
		.notNull()
		.references(() => tasks.id, { onDelete: 'cascade' }),
	predecessorId: text('predecessor_id')
		.notNull()
		.references(() => tasks.id, { onDelete: 'cascade' }),
	type: text('type', { enum: ['FS', 'SS', 'FF', 'SF'] })
		.notNull()
		.default('FS')
});

export const invites = sqliteTable('invites', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	role: text('role', { enum: ['manager', 'member'] })
		.notNull()
		.default('member'),
	expiresAt: timestamp('expires_at').notNull(),
	usedAt: timestamp('used_at')
});

export const activities = sqliteTable('activities', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'restrict' }),
	action: text('action').notNull(),
	payloadJson: text('payload_json').notNull(),
	createdAt: timestamp('created_at').notNull()
});

export const projectRelations = relations(projects, ({ one, many }) => ({
	creator: one(user, { fields: [projects.createdBy], references: [user.id] }),
	members: many(members),
	tasks: many(tasks),
	invites: many(invites),
	activities: many(activities)
}));

export const taskRelations = relations(tasks, ({ one, many }) => ({
	project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
	parent: one(tasks, {
		fields: [tasks.parentId],
		references: [tasks.id],
		relationName: 'task_parent'
	}),
	assignee: one(user, { fields: [tasks.assigneeId], references: [user.id] }),
	children: many(tasks, { relationName: 'task_parent' }),
	dependencies: many(dependencies, { relationName: 'successor' }),
	predecessors: many(dependencies, { relationName: 'predecessor' })
}));
