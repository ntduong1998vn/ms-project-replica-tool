import { addDays } from '$lib/utils/date';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export interface SchedulableTask {
	id: string;
	start_date?: string | null;
	due_date?: string | null;
	duration_days?: number | null;
	milestone?: boolean;
}
export interface DependencyInput {
	task_id: string;
	predecessor_id: string;
	type?: DependencyType;
}
export interface ScheduledTask extends SchedulableTask {
	effective_start: string;
	effective_due: string;
	duration_days: number;
}

function maxDate(a: string, b: string) {
	return a > b ? a : b;
}

export function validateDeps(tasks: SchedulableTask[], deps: DependencyInput[]) {
	const ids = new Set(tasks.map((task) => task.id));
	const graph = new Map<string, string[]>();
	for (const task of tasks) graph.set(task.id, []);
	for (const dep of deps) {
		if (ids.has(dep.task_id) && ids.has(dep.predecessor_id))
			graph.get(dep.predecessor_id)?.push(dep.task_id);
	}
	const state = new Map<string, number>();
	const cycles: string[][] = [];
	const stack: string[] = [];
	const visit = (id: string) => {
		state.set(id, 1);
		stack.push(id);
		for (const next of graph.get(id) ?? []) {
			if (state.get(next) === 1) {
				const index = stack.indexOf(next);
				cycles.push([...stack.slice(index), next]);
			} else if (!state.get(next)) visit(next);
		}
		stack.pop();
		state.set(id, 2);
	};
	for (const task of tasks) if (!state.get(task.id)) visit(task.id);
	return { valid: cycles.length === 0, cycles };
}

function topologicalOrder(tasks: SchedulableTask[], deps: DependencyInput[]) {
	const ids = new Set(tasks.map((task) => task.id));
	const incoming = new Map(tasks.map((task) => [task.id, 0]));
	const outgoing = new Map(tasks.map((task) => [task.id, [] as string[]]));
	for (const dep of deps) {
		if (!ids.has(dep.task_id) || !ids.has(dep.predecessor_id)) continue;
		outgoing.get(dep.predecessor_id)?.push(dep.task_id);
		incoming.set(dep.task_id, (incoming.get(dep.task_id) ?? 0) + 1);
	}
	const queue = tasks.filter((task) => incoming.get(task.id) === 0).map((task) => task.id);
	const order: string[] = [];
	while (queue.length) {
		const id = queue.shift()!;
		order.push(id);
		for (const next of outgoing.get(id) ?? []) {
			incoming.set(next, incoming.get(next)! - 1);
			if (incoming.get(next) === 0) queue.push(next);
		}
	}
	return order.length === tasks.length
		? order
		: [...order, ...tasks.filter((task) => !order.includes(task.id)).map((task) => task.id)];
}

export function computeSchedule(
	tasks: SchedulableTask[],
	deps: DependencyInput[],
	projectStart: string
): ScheduledTask[] {
	const byId = new Map(tasks.map((task) => [task.id, task]));
	const result = new Map<string, ScheduledTask>();
	for (const id of topologicalOrder(tasks, deps)) {
		const task = byId.get(id)!;
		const duration = task.milestone ? 0 : Math.max(0, task.duration_days ?? 1);
		let start = task.start_date ?? projectStart;
		for (const dep of deps.filter((item) => item.task_id === id)) {
			const predecessor = result.get(dep.predecessor_id);
			if (!predecessor) continue;
			const type = dep.type ?? 'FS';
			const requiredStart =
				type === 'SS'
					? predecessor.effective_start
					: type === 'FF'
						? addDays(predecessor.effective_due, -(duration - 1))
						: type === 'SF'
							? addDays(predecessor.effective_start, -(duration - 1))
							: addDays(predecessor.effective_due, 1);
			start = maxDate(start, requiredStart);
		}
		const due = task.milestone ? start : addDays(start, duration - 1);
		result.set(id, {
			...task,
			effective_start: start,
			effective_due: due,
			duration_days: duration
		});
	}
	return tasks.map((task) => result.get(task.id)!);
}
