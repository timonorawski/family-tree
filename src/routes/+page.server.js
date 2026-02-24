import { loadPersons, loadRegions } from '$lib/load-tree.js';

export function load() {
	const persons = loadPersons();
	const regions = loadRegions();
	return { persons, regions };
}
