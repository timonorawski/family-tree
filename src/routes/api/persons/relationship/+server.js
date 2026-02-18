import { json } from '@sveltejs/kit';
import { addRelationship, removeRelationship } from '$lib/store.mjs';

export async function POST({ request }) {
	try {
		const { slug, targetSlug, type } = await request.json();
		const result = addRelationship(slug, targetSlug, type);
		return json(result, { status: 201 });
	} catch (e) {
		return json({ error: e.message }, { status: 400 });
	}
}

export async function DELETE({ request }) {
	try {
		const { slug, targetSlug, type } = await request.json();
		const result = removeRelationship(slug, targetSlug, type);
		return json(result);
	} catch (e) {
		return json({ error: e.message }, { status: 400 });
	}
}
