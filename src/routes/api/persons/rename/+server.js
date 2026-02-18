import { json } from '@sveltejs/kit';
import { rename } from '$lib/store.mjs';

export async function POST({ request }) {
	try {
		const { oldSlug, newSlug } = await request.json();
		const result = rename(oldSlug, newSlug);
		return json(result);
	} catch (e) {
		const status = e.message.includes('not found') ? 404 : 400;
		return json({ error: e.message }, { status });
	}
}
