import { json } from '@sveltejs/kit';
import { update, remove } from '$lib/store.mjs';

export async function PUT({ params, request }) {
	try {
		const body = await request.json();
		const result = update(params.slug, body);
		return json(result);
	} catch (e) {
		const status = e.message.includes('not found') ? 404 : 400;
		return json({ error: e.message }, { status });
	}
}

export async function DELETE({ params }) {
	try {
		const result = remove(params.slug);
		return json(result);
	} catch (e) {
		return json({ error: e.message }, { status: 404 });
	}
}
