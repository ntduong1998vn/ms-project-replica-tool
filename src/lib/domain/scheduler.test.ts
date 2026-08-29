import { describe, expect, it } from 'vitest';
import { computeSchedule, validateDeps } from './scheduler';

const t = (id: string, start_date: string, duration_days: number, milestone = false) => ({
	id,
	start_date,
	duration_days,
	milestone
});

describe('scheduler', () => {
	it('schedules a finish-to-start chain', () => {
		const result = computeSchedule(
			[t('a', '2025-01-04', 2), t('b', '2025-01-01', 3)],
			[{ task_id: 'b', predecessor_id: 'a', type: 'FS' }],
			'2025-01-01'
		);
		expect(result[1].effective_start).toBe('2025-01-06');
		expect(result[1].effective_due).toBe('2025-01-08');
	});

	it('uses the latest predecessor and cascades', () => {
		const tasks = [
			t('a', '2025-01-01', 2),
			t('b', '2025-01-05', 3),
			t('c', '2025-01-01', 1),
			t('d', '2025-01-01', 1)
		];
		const deps = [
			{ task_id: 'c', predecessor_id: 'a' as const },
			{ task_id: 'c', predecessor_id: 'b' as const },
			{ task_id: 'd', predecessor_id: 'c' as const }
		];
		const result = computeSchedule(tasks, deps, '2025-01-01');
		expect(result.find((x) => x.id === 'c')?.effective_start).toBe('2025-01-08');
		expect(result.find((x) => x.id === 'd')?.effective_start).toBe('2025-01-09');
	});

	it('cascades through at least three dependency tiers', () => {
		const tasks = [
			t('a', '2025-01-01', 2),
			t('b', '2025-01-01', 2),
			t('c', '2025-01-01', 2),
			t('d', '2025-01-01', 1)
		];
		const deps = [
			{ task_id: 'b', predecessor_id: 'a' },
			{ task_id: 'c', predecessor_id: 'b' },
			{ task_id: 'd', predecessor_id: 'c' }
		];
		const result = computeSchedule(tasks, deps, '2025-01-01');
		expect(result.find((x) => x.id === 'b')?.effective_start).toBe('2025-01-03');
		expect(result.find((x) => x.id === 'c')?.effective_start).toBe('2025-01-05');
		expect(result.find((x) => x.id === 'd')?.effective_start).toBe('2025-01-07');
	});

	it('keeps a later manual start and handles milestones', () => {
		const result = computeSchedule(
			[t('a', '2025-01-02', 1), t('m', '2025-01-01', 0, true)],
			[{ task_id: 'm', predecessor_id: 'a' }],
			'2025-01-01'
		);
		expect(result[1].effective_start).toBe('2025-01-03');
		expect(result[1].effective_due).toBe('2025-01-03');
	});

	it('keeps a successor manual start later than the dependency constraint', () => {
		const result = computeSchedule(
			[t('a', '2025-01-01', 2), t('b', '2025-01-10', 2)],
			[{ task_id: 'b', predecessor_id: 'a' }],
			'2025-01-01'
		);
		expect(result.find((x) => x.id === 'b')?.effective_start).toBe('2025-01-10');
		expect(result.find((x) => x.id === 'b')?.effective_due).toBe('2025-01-11');
	});

	it('leaves tasks without dependencies unchanged', () => {
		const result = computeSchedule([t('a', '2025-01-04', 2)], [], '2025-01-01');
		expect(result[0].effective_start).toBe('2025-01-04');
		expect(result[0].effective_due).toBe('2025-01-05');
	});

	it('detects cycles and terminates scheduling', () => {
		const tasks = [t('a', '2025-01-01', 1), t('b', '2025-01-01', 1), t('c', '2025-01-01', 1)];
		const deps = [
			{ task_id: 'b', predecessor_id: 'a' },
			{ task_id: 'c', predecessor_id: 'b' },
			{ task_id: 'a', predecessor_id: 'c' }
		];
		expect(validateDeps(tasks, deps).valid).toBe(false);
		expect(() => computeSchedule(tasks, deps, '2025-01-01')).not.toThrow();
	});

	it('supports the other dependency types', () => {
		const tasks = [t('a', '2025-01-05', 3), t('b', '2025-01-01', 2)];
		expect(
			computeSchedule(tasks, [{ task_id: 'b', predecessor_id: 'a', type: 'SS' }], '2025-01-01')[1]
				.effective_start
		).toBe('2025-01-05');
		expect(
			computeSchedule(tasks, [{ task_id: 'b', predecessor_id: 'a', type: 'FF' }], '2025-01-01')[1]
				.effective_due
		).toBe('2025-01-07');
		expect(
			computeSchedule(tasks, [{ task_id: 'b', predecessor_id: 'a', type: 'SF' }], '2025-01-01')[1]
				.effective_start
		).toBe('2025-01-04');
	});
});
