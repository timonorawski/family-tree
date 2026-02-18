import { json } from '@sveltejs/kit';
import { loadAll, create } from '$lib/store.mjs';

export async function GET() {
	return json(loadAll());
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const result = create(body);
		return json(result, { status: 201 });
	} catch (e) {
		return json({ error: e.message }, { status: 400 });
	}
}
