import type { RequestEvent } from '@sveltejs/kit';
import { createDb } from './db';
import { createAuth } from './auth';

export function getDatabase(event: RequestEvent) {
	const database = event.platform?.env?.DB;
	if (!database) {
		throw new Error(
			'D1 binding DB is not available. Start the app through the Cloudflare adapter.'
		);
	}
	return createDb(database);
}

export function getAuth(event: RequestEvent) {
	const secret = event.platform?.env?.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error('BETTER_AUTH_SECRET is not configured. Copy .dev.vars.example to .dev.vars.');
	}
	return createAuth(getDatabase(event), event.url.origin, secret);
}
