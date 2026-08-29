import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDate, isOverdue, parseDate, startOfWeek } from './date';

describe('date utilities', () => {
	it('adds calendar days across month boundaries', () => {
		expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
		expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
	});

	it('calculates differences across leap years', () => {
		expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
		expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0);
		expect(daysBetween('2025-01-02', '2025-01-01')).toBe(-1);
	});

	it('only considers a date overdue after its due date', () => {
		expect(isOverdue('2025-01-01', parseDate('2025-01-02'))).toBe(true);
		expect(isOverdue('2025-01-02', parseDate('2025-01-02'))).toBe(false);
		expect(isOverdue('2025-01-03', parseDate('2025-01-02'))).toBe(false);
	});

	it('round-trips date-only values without timezone drift', () => {
		const value = '2030-12-31';
		expect(formatDate(parseDate(value))).toBe(value);
	});

	it('returns Monday for an ISO week', () => {
		expect(startOfWeek('2025-01-05')).toBe('2024-12-30');
		expect(startOfWeek(parseDate('2025-01-06'))).toBe('2025-01-06');
	});

	it('rejects malformed and impossible dates', () => {
		expect(() => parseDate('2025-2-01')).toThrow();
		expect(() => parseDate('2025-02-29')).toThrow();
		expect(() => formatDate(new Date(Number.NaN))).toThrow();
	});
});
