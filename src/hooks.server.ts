import { redirect, type Handle } from '@sveltejs/kit';
import { getAuth } from '$lib/server/platform';

const publicPaths = ['/login', '/register', '/api/auth', '/api/health', '/invite/'];

function isPublicPath(pathname: string) {
	return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
	if (isPublicPath(event.url.pathname)) return resolve(event);

	try {
		const auth = getAuth(event);
		const session = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = session?.session ?? null;
		event.locals.user = session?.user ?? null;
	} catch (error) {
		console.error('Unable to load auth session', error);
		throw redirect(302, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}

	if (!event.locals.user) {
		throw redirect(302, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}

	return resolve(event);
};
