import { fail, redirect } from '@sveltejs/kit';
import { getAuth } from '$lib/server/platform';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const redirectTo = String(formData.get('redirectTo') ?? '/');

		if (!email || !password) return fail(400, { error: 'Email and password are required.', email });

		try {
			await getAuth(event).api.signInEmail({
				body: { email, password },
				headers: new Headers({ origin: event.url.origin })
			});
		} catch {
			return fail(400, { error: 'Invalid email or password.', email });
		}

		throw redirect(303, redirectTo.startsWith('/') ? redirectTo : '/');
	}
};
