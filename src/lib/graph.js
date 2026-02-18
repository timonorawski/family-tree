/** Build a display name from the structured name object */
export function displayName(name) {
	if (!name) return '';
	if (typeof name === 'string') return name;
	const parts = [name.given];
	if (name.middles) parts.push(...name.middles);
	if (name.surnames?.current) parts.push(name.surnames.current);
	else if (name.surnames?.birth) parts.push(name.surnames.birth);
	return parts.filter(Boolean).join(' ');
}

/**
 * Convert our YAML person map into family-chart's data format.
 *
 * Input:  { [slug]: { name: { given, middles?, surnames? }, gender, relationships?: [{type, person}], dob?, ... } }
 * Output: [{ id, data: { gender, first_name, ... }, rels: { parents, spouses, children } }]
 */
export function toFamilyChartData(persons) {
	// Pre-compute children lookup (parent slug → [child slugs])
	const childrenOf = new Map();
	for (const [slug, p] of Object.entries(persons)) {
		const parents = (p.relationships || [])
			.filter(r => r.type === 'parent')
			.map(r => r.person);
		for (const parentSlug of parents) {
			if (!childrenOf.has(parentSlug)) childrenOf.set(parentSlug, []);
			childrenOf.get(parentSlug).push(slug);
		}
	}

	return Object.entries(persons).map(([slug, p]) => {
		const { name, gender, relationships, ...extra } = p;
		const parents = (relationships || [])
			.filter(r => r.type === 'parent')
			.map(r => r.person);
		const partners = (relationships || [])
			.filter(r => r.type === 'partner')
			.map(r => r.person);
		return {
			id: slug,
			data: {
				gender: gender === 'female' ? 'F' : 'M',
				'first name': displayName(name),
				name,
				birthday: p.dob || '',
				...extra
			},
			rels: {
				parents: parents.filter(s => persons[s]),
				spouses: partners.filter(s => persons[s]),
				children: childrenOf.get(slug) || []
			}
		};
	});
}
