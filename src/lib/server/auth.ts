import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import type { AppDatabase } from './db';
import { account, session, user, verification } from './db/schema';

export function createAuth(database: AppDatabase, origin: string, secret: string) {
	return betterAuth({
		baseURL: origin,
		basePath: '/api/auth',
		secret,
		database: drizzleAdapter(database, {
			provider: 'sqlite',
			schema: { user, session, account, verification },
			transaction: false
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false
		},
		plugins: [sveltekitCookies(getRequestEvent)],
		trustedOrigins: [origin]
	});
}
