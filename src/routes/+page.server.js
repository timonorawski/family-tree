import { loadPersons } from '$lib/load-tree.js';

export function load() {
	const persons = loadPersons();
	return { persons };
}
