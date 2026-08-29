import { addDays, daysBetween } from '$lib/utils/date';

export const taskStatuses = ['todo', 'in_progress', 'blocked', 'done'] as const;
export const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];

export interface TaskInput {
	id?: string;
	parent_id?: string | null;
	title: string;
	start_date?: string | null;
	due_date?: string | null;
	duration_days?: number;
	status?: string;
	priority?: string;
	sort_order?: number;
	[key: string]: unknown;
}

export interface TaskTreeNode<
	T extends { id: string; parent_id?: string | null; sort_order?: number }
> {
	task: T;
	children: TaskTreeNode<T>[];
}

export function validateTask(input: TaskInput) {
	const errors: Record<string, string> = {};
	const title = input.title?.trim() ?? '';
	if (!title) errors.title = 'Title is required.';
	else if ([...title].length > 200) errors.title = 'Title must be 200 characters or fewer.';

	if (input.start_date && input.due_date && input.due_date < input.start_date) {
		errors.due_date = 'Due date must be on or after the start date.';
	}
	if (input.status && !taskStatuses.includes(input.status as TaskStatus)) {
		errors.status = 'Invalid task status.';
	}
	if (input.priority && !taskPriorities.includes(input.priority as TaskPriority)) {
		errors.priority = 'Invalid task priority.';
	}
	if (
		input.duration_days !== undefined &&
		(!Number.isInteger(input.duration_days) || input.duration_days < 0)
	) {
		errors.duration_days = 'Duration must be a non-negative integer.';
	}

	return { valid: Object.keys(errors).length === 0, errors, value: { ...input, title } };
}

export function buildTaskTree<
	T extends { id: string; parent_id?: string | null; sort_order?: number }
>(flatTasks: T[]): TaskTreeNode<T>[] {
	const nodes = new Map(
		flatTasks.map((task) => [task.id, { task, children: [] as TaskTreeNode<T>[] }])
	);
	const roots: TaskTreeNode<T>[] = [];

	for (const node of nodes.values()) {
		const parentId = node.task.parent_id;
		if (!parentId || parentId === node.task.id || !nodes.has(parentId)) {
			roots.push(node);
			continue;
		}
		let cursor: T | undefined = nodes.get(parentId)?.task;
		const seen = new Set<string>([node.task.id]);
		let cycle = false;
		while (cursor) {
			if (seen.has(cursor.id)) {
				cycle = true;
				break;
			}
			seen.add(cursor.id);
			cursor = cursor.parent_id ? nodes.get(cursor.parent_id)?.task : undefined;
		}
		if (cycle) roots.push(node);
		else nodes.get(parentId)?.children.push(node);
	}

	const sort = (items: TaskTreeNode<T>[]) => {
		items.sort((a, b) => (a.task.sort_order ?? 0) - (b.task.sort_order ?? 0));
		for (const item of items) sort(item.children);
	};
	sort(roots);
	return roots;
}

export function deriveDuration(
	startDate: string | null | undefined,
	dueDate: string | null | undefined
) {
	if (!startDate || !dueDate) return 1;
	return Math.max(0, daysBetween(startDate, dueDate) + 1);
}

export function normalizeTaskDates(
	startDate: string | null | undefined,
	dueDate: string | null | undefined,
	durationDays: number,
	milestone = false
) {
	if (milestone && startDate) return { startDate, dueDate: startDate, durationDays: 0 };
	if (startDate && dueDate)
		return { startDate, dueDate, durationDays: deriveDuration(startDate, dueDate) };
	if (startDate)
		return { startDate, dueDate: addDays(startDate, Math.max(0, durationDays - 1)), durationDays };
	return { startDate: null, dueDate: null, durationDays };
}
