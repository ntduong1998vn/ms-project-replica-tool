const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertValidDateParts(year: number, month: number, day: number) {
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		throw new RangeError('Invalid calendar date');
	}
	return date;
}

/** Parse a date-only value at UTC midnight; never uses Date's date-string parser. */
export function parseDate(value: string): Date {
	const match = DATE_PATTERN.exec(value);
	if (!match) throw new RangeError(`Invalid date-only value: ${value}`);
	return assertValidDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Format a Date as a date-only value using its UTC calendar fields. */
export function formatDate(value: Date): string {
	if (Number.isNaN(value.getTime())) throw new RangeError('Invalid date');
	const year = String(value.getUTCFullYear()).padStart(4, '0');
	const month = String(value.getUTCMonth() + 1).padStart(2, '0');
	const day = String(value.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function addDays(value: string, amount: number): string {
	const date = parseDate(value);
	date.setUTCDate(date.getUTCDate() + amount);
	return formatDate(date);
}

export function daysBetween(from: string, to: string): number {
	return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

export function isOverdue(dueDate: string, now: Date = new Date()): boolean {
	return formatDate(now) > dueDate;
}

/** Return the Monday of the ISO week containing the supplied date. */
export function startOfWeek(value: string | Date): string {
	const date = typeof value === 'string' ? parseDate(value) : new Date(value.getTime());
	const day = date.getUTCDay();
	const daysFromMonday = (day + 6) % 7;
	date.setUTCDate(date.getUTCDate() - daysFromMonday);
	return formatDate(date);
}
