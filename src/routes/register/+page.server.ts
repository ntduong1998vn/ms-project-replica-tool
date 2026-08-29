import { fail, redirect } from '@sveltejs/kit';
import { getAuth } from '$lib/server/platform';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!name || !email || password.length < 8) {
			return fail(400, {
				error: 'Name, email, and a password of at least 8 characters are required.',
				name,
				email
			});
		}

		try {
			await getAuth(event).api.signUpEmail({
				body: { name, email, password },
				headers: new Headers({ origin: event.url.origin })
			});
		} catch {
			return fail(400, {
				error: 'Unable to create this account. The email may already be in use.',
				name,
				email
			});
		}

		throw redirect(303, '/');
	}
};
