import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const database = platform?.env?.DB;
	if (!database) {
		return json({ ok: false, error: 'D1 binding DB is not available' }, { status: 503 });
	}

	const result = await database.prepare('SELECT 1 AS value').first<{ value: number }>();
	return json({ ok: result?.value === 1 });
};
