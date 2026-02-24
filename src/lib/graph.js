/** Build a display name from the structured name object */
export function displayName(name, titles) {
	if (!name) return '';
	if (typeof name === 'string') return name;
	const givenPart = name.preferred
		? `${name.preferred} (${name.given})`
		: name.given;
	const parts = [givenPart];
	if (name.middles) parts.push(...name.middles);
	if (name.surnames?.current) parts.push(name.surnames.current);
	else if (name.surnames?.birth) parts.push(name.surnames.birth);
	let display = parts.filter(Boolean).join(' ');
	if (titles?.length) {
		const prefix = titles
			.filter((t) => ['civic', 'religious', 'academic'].includes(t.type))
			.map((t) => t.value);
		if (prefix.length) display = prefix.join(' ') + ' ' + display;
	}
	return display;
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

	// Pre-compute partner lookup for bidirectional normalization
	const partnersOf = new Map();
	for (const [slug, p] of Object.entries(persons)) {
		const partners = (p.relationships || [])
			.filter(r => r.type === 'partner')
			.map(r => r.person)
			.filter(s => persons[s]);
		partnersOf.set(slug, new Set(partners));
	}
	// Normalize: if A lists B as partner, ensure B also lists A
	for (const [slug, partners] of partnersOf) {
		for (const partnerSlug of partners) {
			const theirPartners = partnersOf.get(partnerSlug);
			if (theirPartners && !theirPartners.has(slug)) {
				theirPartners.add(slug);
			}
		}
	}

	return Object.entries(persons).map(([slug, p]) => {
		const { name, gender, relationships, ...extra } = p;
		const parents = (relationships || [])
			.filter(r => r.type === 'parent')
			.map(r => r.person);
		return {
			id: slug,
			data: {
				gender: gender === 'female' ? 'F' : 'M',
				'first name': displayName(name, p.titles),
				name,
				relationships: relationships || [],
				birthday: p.locations?.birth?.date || '',
				...extra
			},
			rels: {
				parents: parents.filter(s => persons[s]),
				spouses: [...(partnersOf.get(slug) || [])],
				children: childrenOf.get(slug) || []
			}
		};
	});
}
