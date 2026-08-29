import { describe, expect, it } from 'vitest';
import { buildTaskTree, deriveDuration, normalizeTaskDates, validateTask } from './task';

const task = (id: string, parent_id: string | null = null, sort_order = 0) => ({
	id,
	parent_id,
	sort_order
});

describe('task domain', () => {
	it('validates task fields', () => {
		expect(
			validateTask({ title: 'x', start_date: '2025-02-02', due_date: '2025-02-01' }).errors.due_date
		).toBeTruthy();
		expect(
			validateTask({ title: undefined } as unknown as { title: string }).errors.title
		).toBeTruthy();
		expect(validateTask({ title: '', status: 'later' }).valid).toBe(false);
		expect(validateTask({ title: 'ok', status: 'done', priority: 'urgent' }).valid).toBe(true);
		expect(validateTask({ title: 'ok', status: 'nope' }).errors.status).toBeTruthy();
		expect(validateTask({ title: 'ok', priority: 'nope' }).errors.priority).toBeTruthy();
		expect(validateTask({ title: 'x'.repeat(201) }).errors.title).toBeTruthy();
		expect(validateTask({ title: 'ok', duration_days: 1.5 }).errors.duration_days).toBeTruthy();
		expect(validateTask({ title: 'ok', duration_days: -1 }).errors.duration_days).toBeTruthy();
		expect(validateTask({ title: ' ok ' }).value.title).toBe('ok');
	});

	it('builds a sorted forest', () => {
		const result = buildTaskTree([
			task('b', 'a', 2),
			task('a', null, 2),
			task('c', 'a', 1),
			task('root', null, 1),
			task('orphan', 'missing', 0),
			task('leaf', 'c', 0)
		]);
		expect(result.map((item) => item.task.id)).toEqual(['orphan', 'root', 'a']);
		expect(result[2].children.map((item) => item.task.id)).toEqual(['c', 'b']);
		expect(result[2].children[0].children[0].task.id).toBe('leaf');
	});

	it('promotes self references and cycles to roots without recursing forever', () => {
		const result = buildTaskTree([task('a', 'b'), task('b', 'a')]);
		expect(result).toHaveLength(2);
		expect(buildTaskTree([task('self', 'self')])[0].task.id).toBe('self');
		expect(
			buildTaskTree([{ id: 'unsorted' }, { id: 'sorted', sort_order: 1 }]).map(
				(item) => item.task.id
			)
		).toEqual(['unsorted', 'sorted']);
	});

	it('derives and normalizes dates', () => {
		expect(deriveDuration('2025-01-01', '2025-01-03')).toBe(3);
		expect(deriveDuration(null, null)).toBe(1);
		expect(normalizeTaskDates('2025-01-01', '2025-01-03', 99)).toEqual({
			startDate: '2025-01-01',
			dueDate: '2025-01-03',
			durationDays: 3
		});
		expect(normalizeTaskDates('2025-01-01', null, 3)).toEqual({
			startDate: '2025-01-01',
			dueDate: '2025-01-03',
			durationDays: 3
		});
		expect(normalizeTaskDates('2025-01-01', '2025-01-10', 1, true)).toEqual({
			startDate: '2025-01-01',
			dueDate: '2025-01-01',
			durationDays: 0
		});
		expect(normalizeTaskDates(null, null, 2)).toEqual({
			startDate: null,
			dueDate: null,
			durationDays: 2
		});
		expect(validateTask({ title: 'ok' }).valid).toBe(true);
	});
});
