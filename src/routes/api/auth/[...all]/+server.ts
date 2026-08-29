import type { RequestHandler } from './$types';
import { getAuth } from '$lib/server/platform';

const handler: RequestHandler = async (event) => getAuth(event).handler(event.request);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
