export function newId() {
	return crypto.randomUUID();
}

export function newInviteToken() {
	return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
}
