<script>
	/**
	 * @type {{ person: any, persons: Record<string, any>, chartData: any[], onNavigate: (slug: string) => void, onSaved: () => void, readonly?: boolean }}
	 */
	let { person, persons, chartData, onNavigate, onSaved, readonly = false } = $props();

	let form = $state({});
	let saving = $state(false);
	let mode = $state('view');
	let addingRelType = $state(null);
	let addSearch = $state('');

	function syncFormFromNode() {
		const node = chartData.find((n) => n.id === person);
		if (node) {
			const n = node.data.name || {};
			form = {
				given: (typeof n === 'string' ? n : n.given) || '',
				given_at_birth: n.given_at_birth || '',
				preferred: n.preferred || '',
				middles: (n.middles || []).join(', '),
				surname_current: n.surnames?.current || '',
				surname_birth: n.surnames?.birth || '',
				gender: node.data.gender === 'F' ? 'female' : 'male',
				dob: node.data.dob || '',
				dod: node.data.dod || '',
				country_of_birth: node.data.country_of_birth || '',
				deceased: node.data.deceased || false,
				profession: node.data.profession || '',
				interesting_facts: node.data.interesting_facts || '',
				research: (node.data.research || []).map((r) => ({
					description: r.description || '',
					confidence: r.confidence ?? '',
					sources: r.sources ? [...r.sources] : ['']
				})),
				stories: (node.data.stories || []).map((s) => ({
					name: s.name || '',
					description: s.description || '',
					sources: s.sources ? [...s.sources] : [],
					places: s.places ? [...s.places] : [],
					dates: s.dates ? [...s.dates] : [],
					people: s.people ? [...s.people] : []
				})),
				titles: (node.data.titles || []).map((t) => ({
					value: t.value || '',
					type: t.type || 'civic'
				})),
				aliases: node.data.aliases ? [...node.data.aliases] : [],
				relationships: (node.data.relationships || []).map((r) => ({
					type: r.type,
					person: r.person,
					start_date: r.start_date || '',
					end_date: r.end_date || '',
					locations: r.locations ? [...r.locations] : []
				}))
			};
		}
	}

	// Sync form state when person changes
	$effect(() => {
		if (person) {
			syncFormFromNode();
			mode = 'view';
			addingRelType = null;
			addSearch = '';
		}
	});

	function cancel() {
		syncFormFromNode();
		mode = 'view';
	}

	function getRelMeta(slug, type) {
		const node = currentNode();
		if (!node?.data.relationships) return null;
		return node.data.relationships.find(r => r.person === slug && r.type === type) || null;
	}

	function formatRelMeta(rel) {
		if (!rel) return '';
		const parts = [];
		if (rel.start_date && rel.end_date) parts.push(`${rel.start_date} \u2013 ${rel.end_date}`);
		else if (rel.start_date) parts.push(rel.start_date);
		else if (rel.end_date) parts.push(`\u2013 ${rel.end_date}`);
		if (rel.locations?.length) parts.push(rel.locations.join(', '));
		return parts.join(' \u00b7 ');
	}

	function getNode(slug) {
		return chartData.find((n) => n.id === slug);
	}

	function getName(slug) {
		const node = getNode(slug);
		return node ? node.data['first name'] : slug;
	}

	function currentNode() {
		return getNode(person);
	}

	function displayName() {
		const node = currentNode();
		if (!node) return 'Unnamed';
		const n = node.data.name || {};
		const rawGiven = (typeof n === 'string' ? n : n.given) || '';
		const givenPart = n.preferred ? `${n.preferred} (${rawGiven})` : rawGiven;
		const surname = n.surnames?.current || n.surnames?.birth || '';
		return [givenPart, surname].filter(Boolean).join(' ') || 'Unnamed';
	}

	function siblings() {
		const node = currentNode();
		if (!node || !node.rels.parents.length) return [];
		const sibs = new Set();
		for (const parentSlug of node.rels.parents) {
			const parent = getNode(parentSlug);
			if (parent) {
				for (const childSlug of parent.rels.children) {
					if (childSlug !== person) sibs.add(childSlug);
				}
			}
		}
		return [...sibs];
	}

	function buildPayload() {
		const { given, given_at_birth, preferred, middles, surname_current, surname_birth, research, stories, titles, aliases, relationships: formRels, ...rest } = form;
		const name = { given };
		if (given_at_birth) name.given_at_birth = given_at_birth;
		if (preferred) name.preferred = preferred;
		const middlesArr = middles ? middles.split(',').map((s) => s.trim()).filter(Boolean) : [];
		if (middlesArr.length) name.middles = middlesArr;
		const surnames = {};
		if (surname_current) surnames.current = surname_current;
		if (surname_birth) surnames.birth = surname_birth;
		if (Object.keys(surnames).length) name.surnames = surnames;

		const payload = { name, ...rest };

		// Build relationships array, cleaning empty metadata
		const relsArr = (formRels || []).map((r) => {
			const rel = { type: r.type, person: r.person };
			if (r.start_date) rel.start_date = r.start_date;
			if (r.end_date) rel.end_date = r.end_date;
			const locs = (r.locations || []).filter(Boolean);
			if (locs.length) rel.locations = locs;
			return rel;
		});
		if (relsArr.length) payload.relationships = relsArr;

		// Build research array, filtering out empty entries
		const researchArr = (research || [])
			.map((r) => {
				const entry = {};
				if (r.description) entry.description = r.description;
				if (r.confidence !== '' && r.confidence != null) entry.confidence = Number(r.confidence);
				const sources = (r.sources || []).filter(Boolean);
				if (sources.length) entry.sources = sources;
				return entry;
			})
			.filter((r) => Object.keys(r).length > 0);
		if (researchArr.length) payload.research = researchArr;

		// Build stories array, filtering out empty entries
		const storiesArr = (stories || [])
			.map((s) => {
				const entry = {};
				if (s.name) entry.name = s.name;
				if (s.description) entry.description = s.description;
				const sources = (s.sources || []).filter(Boolean);
				if (sources.length) entry.sources = sources;
				const places = (s.places || []).filter(Boolean);
				if (places.length) entry.places = places;
				const dates = (s.dates || []).filter(Boolean);
				if (dates.length) entry.dates = dates;
				const people = (s.people || []).filter(Boolean);
				if (people.length) entry.people = people;
				return entry;
			})
			.filter((s) => s.name || s.description);
		if (storiesArr.length) payload.stories = storiesArr;

		// Build titles array, filtering out empty entries
		const titlesArr = (titles || []).filter((t) => t.value);
		if (titlesArr.length) payload.titles = titlesArr;

		// Build aliases array, filtering out empty entries
		const aliasesArr = (aliases || []).filter(Boolean);
		if (aliasesArr.length) payload.aliases = aliasesArr;

		return payload;
	}

	function addResearchEntry() {
		form.research = [...form.research, { description: '', confidence: '', sources: [''] }];
	}

	function removeResearchEntry(index) {
		form.research = form.research.filter((_, i) => i !== index);
	}

	function addSource(entryIndex) {
		form.research[entryIndex].sources = [...form.research[entryIndex].sources, ''];
	}

	function removeSource(entryIndex, sourceIndex) {
		form.research[entryIndex].sources = form.research[entryIndex].sources.filter((_, i) => i !== sourceIndex);
	}

	function addStory() {
		form.stories = [...form.stories, { name: '', description: '', sources: [], places: [], dates: [], people: [] }];
	}

	function removeStory(index) {
		form.stories = form.stories.filter((_, i) => i !== index);
	}

	function addStoryListItem(storyIndex, field) {
		form.stories[storyIndex][field] = [...form.stories[storyIndex][field], ''];
	}

	function removeStoryListItem(storyIndex, field, itemIndex) {
		form.stories[storyIndex][field] = form.stories[storyIndex][field].filter((_, i) => i !== itemIndex);
	}

	function addTitle() {
		form.titles = [...form.titles, { value: '', type: 'civic' }];
	}

	function removeTitle(index) {
		form.titles = form.titles.filter((_, i) => i !== index);
	}

	function addAlias() {
		form.aliases = [...form.aliases, ''];
	}

	function removeAlias(index) {
		form.aliases = form.aliases.filter((_, i) => i !== index);
	}

	function getFormRel(slug, type) {
		return form.relationships?.find(r => r.person === slug && r.type === type);
	}

	function addRelLocation(relIndex) {
		form.relationships[relIndex].locations = [...form.relationships[relIndex].locations, ''];
	}

	function removeRelLocation(relIndex, locIndex) {
		form.relationships[relIndex].locations = form.relationships[relIndex].locations.filter((_, i) => i !== locIndex);
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/persons/${person}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload())
			});
			if (res.ok) {
				await onSaved();
				mode = 'view';
			}
		} finally {
			saving = false;
		}
	}

	async function addRelative(relationship) {
		const given = prompt(`New ${relationship}'s given name:`);
		if (!given) return;
		const gender = prompt('Gender (male/female):', 'male');
		if (!gender) return;

		const newPerson = { name: { given }, gender };

		// For child: new person gets current person as parent
		if (relationship === 'child') {
			const node = currentNode();
			const rels = [{ type: 'parent', person: person }];
			if (node.rels.spouses.length) {
				rels.push({ type: 'parent', person: node.rels.spouses[0] });
			}
			newPerson.relationships = rels;
		}

		const res = await fetch('/api/persons', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newPerson)
		});

		if (!res.ok) return;
		const created = await res.json();

		// Link back using relationship API
		if (relationship === 'parent') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: person, targetSlug: created.slug, type: 'parent' })
			});
		} else if (relationship === 'sibling') {
			const node = currentNode();
			for (const parentSlug of node.rels.parents) {
				await fetch('/api/persons/relationship', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ slug: created.slug, targetSlug: parentSlug, type: 'parent' })
				});
			}
		} else if (relationship === 'partner') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: person, targetSlug: created.slug, type: 'partner' })
			});
		}
		// child: already linked via newPerson.relationships above

		onSaved();
	}

	let filteredPersons = $derived.by(() => {
		if (!addingRelType) return [];
		const node = currentNode();
		if (!node) return [];

		const excludeSlugs = new Set([person]);
		if (addingRelType === 'parent') node.rels.parents.forEach(s => excludeSlugs.add(s));
		else if (addingRelType === 'partner') node.rels.spouses.forEach(s => excludeSlugs.add(s));
		else if (addingRelType === 'child') node.rels.children.forEach(s => excludeSlugs.add(s));
		else if (addingRelType === 'sibling') siblings().forEach(s => excludeSlugs.add(s));

		const query = addSearch.toLowerCase().trim();
		return chartData
			.filter(n => {
				if (excludeSlugs.has(n.id)) return false;
				if (!query) return true;
				const name = (n.data['first name'] || '').toLowerCase();
				const given = (typeof n.data.name === 'object' ? n.data.name?.given || '' : '').toLowerCase();
				const preferred = (typeof n.data.name === 'object' ? n.data.name?.preferred || '' : '').toLowerCase();
				const surname = (typeof n.data.name === 'object' ? (n.data.name?.surnames?.current || n.data.name?.surnames?.birth || '') : '').toLowerCase();
				return name.includes(query) || given.includes(query) || preferred.includes(query) || surname.includes(query);
			})
			.sort((a, b) => (a.data['first name'] || '').localeCompare(b.data['first name'] || ''))
			.slice(0, 20);
	});

	async function linkExisting(existingSlug) {
		if (addingRelType === 'parent') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: person, targetSlug: existingSlug, type: 'parent' })
			});
		} else if (addingRelType === 'partner') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: person, targetSlug: existingSlug, type: 'partner' })
			});
		} else if (addingRelType === 'sibling') {
			const node = currentNode();
			for (const parentSlug of node.rels.parents) {
				await fetch('/api/persons/relationship', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ slug: existingSlug, targetSlug: parentSlug, type: 'parent' })
				});
			}
		} else if (addingRelType === 'child') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: existingSlug, targetSlug: person, type: 'parent' })
			});
		}
		addingRelType = null;
		addSearch = '';
		onSaved();
	}

	async function deletePerson() {
		if (!confirm(`Delete ${form.given}?`)) return;
		const res = await fetch(`/api/persons/${person}`, { method: 'DELETE' });
		if (res.ok) onSaved();
	}
</script>

{#if person && currentNode()}
	{@const node = currentNode()}
	<aside class="sidebar">
		<div class="sidebar-header">
			<h2>{displayName()}</h2>
			<div class="header-actions">
				{#if readonly}
					<button class="header-btn close-btn" onclick={() => onNavigate('')}>&times;</button>
				{:else if mode === 'view'}
					<button class="header-btn edit-btn" onclick={() => mode = 'edit'}>Edit</button>
					<button class="header-btn close-btn" onclick={() => onNavigate('')}>&times;</button>
				{:else}
					<button class="header-btn save-btn" disabled={saving} onclick={save}>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button class="header-btn delete-btn" onclick={deletePerson}>Delete</button>
					<button class="header-btn cancel-btn" onclick={cancel}>Cancel</button>
				{/if}
			</div>
		</div>

		<div class="sidebar-body">
			{#if mode === 'view'}
				<div class="view-content">
					{#if node.data.name?.preferred}
						<div class="detail-row">
							<span class="detail-label">Preferred name</span>
							<span class="detail-value">{node.data.name.preferred}</span>
						</div>
					{/if}

					{#if node.data.name?.given_at_birth}
						<div class="detail-row">
							<span class="detail-label">Given name at birth</span>
							<span class="detail-value">{node.data.name.given_at_birth}</span>
						</div>
					{/if}

					{#if node.data.dob || node.data.dod || node.data.country_of_birth}
						<div class="dates-line">
							{#if node.data.dob}b. {node.data.dob}{/if}{#if node.data.country_of_birth}{node.data.dob ? ', ' : ''}{node.data.country_of_birth}{/if}{#if node.data.dod}{(node.data.dob || node.data.country_of_birth) ? ' \u2014 ' : ''}d. {node.data.dod}{/if}
						</div>
					{/if}

					{#if node.data.profession}
						<div class="detail-row">
							<span class="detail-label">Profession</span>
							<span class="detail-value">{node.data.profession}</span>
						</div>
					{/if}

					{#if node.data.titles?.length}
						<div class="detail-row">
							<span class="detail-label">Titles</span>
							<div class="tags">
								{#each node.data.titles as title}
									<span class="tag"><span class="tag-type">{title.type}</span> {title.value}</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if node.data.aliases?.length}
						<div class="detail-row">
							<span class="detail-label">Aliases</span>
							<span class="detail-value">{node.data.aliases.join(', ')}</span>
						</div>
					{/if}

					{#if node.data.interesting_facts}
						<div class="detail-row">
							<span class="detail-label">Interesting facts</span>
							<p class="detail-text">{node.data.interesting_facts}</p>
						</div>
					{/if}

					{#if node.data.research?.length}
						<div class="detail-row">
							<span class="detail-label">Research</span>
							{#each node.data.research as entry}
								<div class="view-card">
									{#if entry.description}<p>{entry.description}</p>{/if}
									{#if entry.confidence != null}<span class="confidence">Confidence: {entry.confidence}%</span>{/if}
									{#if entry.sources?.length}
										<div class="view-sources">
											{#each entry.sources as source}
												{#if typeof source === 'string' && source.startsWith('http')}
													<a href={source} target="_blank" rel="noopener">{source}</a>
												{:else}
													<span>{source}</span>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if node.data.stories?.length}
						<div class="detail-row">
							<span class="detail-label">Stories</span>
							{#each node.data.stories as story}
								<div class="view-card">
									{#if story.name}<strong>{story.name}</strong>{/if}
									{#if story.description}<p>{story.description}</p>{/if}
									{#if story.places?.length}<div class="sub-items">Places: {story.places.join(', ')}</div>{/if}
									{#if story.dates?.length}<div class="sub-items">Dates: {story.dates.join(', ')}</div>{/if}
									{#if story.people?.length}<div class="sub-items">People: {story.people.join(', ')}</div>{/if}
									{#if story.sources?.length}
										<div class="view-sources">
											{#each story.sources as source}
												{#if typeof source === 'string' && source.startsWith('http')}
													<a href={source} target="_blank" rel="noopener">{source}</a>
												{:else}
													<span>{source}</span>
												{/if}
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else}
				<form onsubmit={(e) => { e.preventDefault(); save(); }}>
					<label>
						Given name
						<input type="text" bind:value={form.given} />
					</label>

					<label>
						Given name at birth
						<input type="text" bind:value={form.given_at_birth} />
					</label>

					<label>
						Preferred name
						<input type="text" bind:value={form.preferred} />
					</label>

					<label>
						Middle names <span class="hint">(comma-separated)</span>
						<input type="text" bind:value={form.middles} />
					</label>

					<label>
						Surname (current)
						<input type="text" bind:value={form.surname_current} />
					</label>

					<label>
						Surname (at birth)
						<input type="text" bind:value={form.surname_birth} />
					</label>

					<label>
						Gender
						<select bind:value={form.gender}>
							<option value="male">Male</option>
							<option value="female">Female</option>
						</select>
					</label>

					<label>
						Date of birth
						<input type="date" bind:value={form.dob} />
					</label>

					<label>
						Country of birth
						<input type="text" bind:value={form.country_of_birth} />
					</label>

					<label>
						Profession
						<input type="text" bind:value={form.profession} />
					</label>

					<label>
						Date of death
						<input type="date" bind:value={form.dod} />
					</label>

					<label class="checkbox-label">
						<input type="checkbox" bind:checked={form.deceased} />
						Deceased
					</label>

					<label>
						Interesting facts
						<textarea bind:value={form.interesting_facts} rows="3"></textarea>
					</label>

					<fieldset class="research-section">
						<legend>Titles</legend>
						{#each form.titles as title, i}
							<div class="title-row">
								<select bind:value={title.type}>
									<option value="civic">Civic</option>
									<option value="noble">Noble</option>
									<option value="military">Military</option>
									<option value="religious">Religious</option>
									<option value="academic">Academic</option>
								</select>
								<input type="text" bind:value={title.value} placeholder="e.g. Sir, Dr., Earl" />
								<button type="button" class="remove-btn" onclick={() => removeTitle(i)}>x</button>
							</div>
						{/each}
						<button type="button" class="add-inline-btn" onclick={addTitle}>+ Title</button>
					</fieldset>

					<fieldset class="research-section">
						<legend>Aliases</legend>
						{#each form.aliases as _, i}
							<div class="source-row">
								<input type="text" bind:value={form.aliases[i]} placeholder="Informal name or alias" />
								<button type="button" class="remove-btn" onclick={() => removeAlias(i)}>x</button>
							</div>
						{/each}
						<button type="button" class="add-inline-btn" onclick={addAlias}>+ Alias</button>
					</fieldset>

					<fieldset class="research-section">
						<legend>Research</legend>
						{#each form.research as entry, i}
							<div class="research-entry">
								<div class="research-entry-header">
									<span class="research-entry-num">#{i + 1}</span>
									<button type="button" class="remove-btn" onclick={() => removeResearchEntry(i)}>x</button>
								</div>
								<label>
									Description
									<textarea bind:value={entry.description} rows="2"></textarea>
								</label>
								<label>
									Confidence <span class="hint">(0-100)</span>
									<input type="number" min="0" max="100" bind:value={entry.confidence} />
								</label>
								<div class="sources-group">
									<span class="sources-label">Sources</span>
									{#each entry.sources as source, j}
										<div class="source-row">
											<input type="text" bind:value={entry.sources[j]} placeholder="URL, book, etc." />
											<button type="button" class="remove-btn" onclick={() => removeSource(i, j)}>x</button>
										</div>
									{/each}
									<button type="button" class="add-inline-btn" onclick={() => addSource(i)}>+ Source</button>
								</div>
							</div>
						{/each}
						<button type="button" class="add-inline-btn" onclick={addResearchEntry}>+ Research entry</button>
					</fieldset>

					<fieldset class="research-section">
						<legend>Stories</legend>
						{#each form.stories as story, i}
							<div class="research-entry">
								<div class="research-entry-header">
									<span class="research-entry-num">#{i + 1}</span>
									<button type="button" class="remove-btn" onclick={() => removeStory(i)}>x</button>
								</div>
								<label>
									Name
									<input type="text" bind:value={story.name} />
								</label>
								<label>
									Description
									<textarea bind:value={story.description} rows="3"></textarea>
								</label>
								<div class="sources-group">
									<span class="sources-label">Sources</span>
									{#each story.sources as _, j}
										<div class="source-row">
											<input type="text" bind:value={story.sources[j]} placeholder="URL, book, etc." />
											<button type="button" class="remove-btn" onclick={() => removeStoryListItem(i, 'sources', j)}>x</button>
										</div>
									{/each}
									<button type="button" class="add-inline-btn" onclick={() => addStoryListItem(i, 'sources')}>+ Source</button>
								</div>
								<div class="sources-group">
									<span class="sources-label">People</span>
									{#each story.people as _, j}
										<div class="source-row">
											<input type="text" bind:value={story.people[j]} placeholder="Person slug" />
											<button type="button" class="remove-btn" onclick={() => removeStoryListItem(i, 'people', j)}>x</button>
										</div>
									{/each}
									<button type="button" class="add-inline-btn" onclick={() => addStoryListItem(i, 'people')}>+ Person</button>
								</div>
								<div class="sources-group">
									<span class="sources-label">Places</span>
									{#each story.places as _, j}
										<div class="source-row">
											<input type="text" bind:value={story.places[j]} placeholder="Location" />
											<button type="button" class="remove-btn" onclick={() => removeStoryListItem(i, 'places', j)}>x</button>
										</div>
									{/each}
									<button type="button" class="add-inline-btn" onclick={() => addStoryListItem(i, 'places')}>+ Place</button>
								</div>
								<div class="sources-group">
									<span class="sources-label">Dates</span>
									{#each story.dates as _, j}
										<div class="source-row">
											<input type="text" bind:value={story.dates[j]} placeholder="YYYY-MM-DD or description" />
											<button type="button" class="remove-btn" onclick={() => removeStoryListItem(i, 'dates', j)}>x</button>
										</div>
									{/each}
									<button type="button" class="add-inline-btn" onclick={() => addStoryListItem(i, 'dates')}>+ Date</button>
								</div>
							</div>
						{/each}
						<button type="button" class="add-inline-btn" onclick={addStory}>+ Story</button>
					</fieldset>
				</form>
			{/if}

			<hr />

			<section class="relations">
				{#if node.rels.parents.length}
					<div class="relation-group">
						<span class="relation-label">Parents</span>
						{#each node.rels.parents as slug}
							{@const rel = mode === 'edit' ? getFormRel(slug, 'parent') : null}
							<div class="rel-entry">
								<button class="chip" onclick={() => onNavigate(slug)}>{getName(slug)}</button>
								{#if mode === 'view' && formatRelMeta(getRelMeta(slug, 'parent'))}
									<span class="rel-meta">{formatRelMeta(getRelMeta(slug, 'parent'))}</span>
								{/if}
							</div>
							{#if rel}
								{@const ri = form.relationships.indexOf(rel)}
								<div class="rel-edit">
									<label>Start <input type="date" bind:value={rel.start_date} /></label>
									<label>End <input type="date" bind:value={rel.end_date} /></label>
									<div class="sources-group">
										<span class="sources-label">Locations</span>
										{#each rel.locations as _, li}
											<div class="source-row">
												<input type="text" bind:value={rel.locations[li]} placeholder="Location" />
												<button type="button" class="remove-btn" onclick={() => removeRelLocation(ri, li)}>x</button>
											</div>
										{/each}
										<button type="button" class="add-inline-btn" onclick={() => addRelLocation(ri)}>+ Location</button>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				{#if siblings().length}
					<div class="relation-group">
						<span class="relation-label">Siblings</span>
						<div class="chips">
							{#each siblings() as slug}
								<button class="chip" onclick={() => onNavigate(slug)}>{getName(slug)}</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if node.rels.spouses.length}
					<div class="relation-group">
						<span class="relation-label">Partners</span>
						{#each node.rels.spouses as slug}
							{@const rel = mode === 'edit' ? getFormRel(slug, 'partner') : null}
							<div class="rel-entry">
								<button class="chip" onclick={() => onNavigate(slug)}>{getName(slug)}</button>
								{#if mode === 'view' && formatRelMeta(getRelMeta(slug, 'partner'))}
									<span class="rel-meta">{formatRelMeta(getRelMeta(slug, 'partner'))}</span>
								{/if}
							</div>
							{#if rel}
								{@const ri = form.relationships.indexOf(rel)}
								<div class="rel-edit">
									<label>Start <input type="date" bind:value={rel.start_date} /></label>
									<label>End <input type="date" bind:value={rel.end_date} /></label>
									<div class="sources-group">
										<span class="sources-label">Locations</span>
										{#each rel.locations as _, li}
											<div class="source-row">
												<input type="text" bind:value={rel.locations[li]} placeholder="Location" />
												<button type="button" class="remove-btn" onclick={() => removeRelLocation(ri, li)}>x</button>
											</div>
										{/each}
										<button type="button" class="add-inline-btn" onclick={() => addRelLocation(ri)}>+ Location</button>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				{#if node.rels.children.length}
					<div class="relation-group">
						<span class="relation-label">Children</span>
						<div class="chips">
							{#each node.rels.children as slug}
								<button class="chip" onclick={() => onNavigate(slug)}>{getName(slug)}</button>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			{#if !readonly}
			<hr />

			<section class="add-relatives">
				{#if addingRelType}
					<div class="add-panel">
						<div class="add-panel-header">
							<span class="add-panel-title">Add {addingRelType}</span>
							<button class="header-btn cancel-btn" onclick={() => { addingRelType = null; addSearch = ''; }}>Cancel</button>
						</div>
						<input
							class="add-search"
							type="text"
							placeholder="Search people..."
							bind:value={addSearch}
							autofocus
						/>
						{#if filteredPersons.length}
							<div class="add-results">
								{#each filteredPersons as node}
									<button class="add-result" onclick={() => linkExisting(node.id)}>
										{node.data['first name'] || node.id}
									</button>
								{/each}
							</div>
						{:else}
							<div class="add-no-results">No matches</div>
						{/if}
						<button class="add-create-btn" onclick={() => { const rel = addingRelType; addingRelType = null; addSearch = ''; addRelative(rel); }}>
							+ Create new person
						</button>
					</div>
				{:else}
					<button onclick={() => addingRelType = 'parent'}>+ Parent</button>
					<button onclick={() => addingRelType = 'sibling'}>+ Sibling</button>
					<button onclick={() => addingRelType = 'partner'}>+ Partner</button>
					<button onclick={() => addingRelType = 'child'}>+ Child</button>
				{/if}
			</section>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.sidebar {
		width: 360px;
		min-width: 360px;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #1a1a2e;
		color: #e0e0e0;
		box-sizing: border-box;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		border-left: 1px solid #333;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid #333;
		flex-shrink: 0;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.header-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.header-btn {
		padding: 4px 10px;
		border: 1px solid #444;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		background: #16213e;
		color: #e0e0e0;
	}
	.header-btn:hover {
		border-color: #5e60ce;
		color: #fff;
	}

	.header-btn.save-btn {
		background: #5e60ce;
		border-color: #5e60ce;
		color: #fff;
	}
	.header-btn.save-btn:hover {
		background: #7b7fd4;
	}
	.header-btn.save-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.header-btn.delete-btn {
		background: #c0392b;
		border-color: #c0392b;
		color: #fff;
	}
	.header-btn.delete-btn:hover {
		background: #e74c3c;
	}

	.header-btn.close-btn {
		font-size: 16px;
		line-height: 1;
	}

	.sidebar-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	/* View mode */
	.view-content {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.dates-line {
		color: #aaa;
		font-size: 13px;
	}

	.detail-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.detail-label {
		font-size: 11px;
		text-transform: uppercase;
		color: #888;
		letter-spacing: 0.05em;
	}

	.detail-value {
		color: #e0e0e0;
	}

	.detail-text {
		margin: 0;
		color: #e0e0e0;
		white-space: pre-wrap;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tag {
		background: #16213e;
		border: 1px solid #444;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
		color: #e0e0e0;
	}

	.tag-type {
		color: #888;
		font-size: 10px;
		text-transform: uppercase;
		margin-right: 4px;
	}

	.view-card {
		background: #16213e;
		border-radius: 4px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.view-card p {
		margin: 0;
		font-size: 13px;
	}

	.view-card strong {
		font-size: 14px;
	}

	.confidence {
		font-size: 12px;
		color: #aaa;
	}

	.sub-items {
		font-size: 12px;
		color: #aaa;
	}

	.view-sources {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
	}

	.view-sources a {
		color: #5e60ce;
		text-decoration: none;
		word-break: break-all;
	}
	.view-sources a:hover {
		text-decoration: underline;
	}

	/* Edit mode / form */
	form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 12px;
		color: #aaa;
	}

	.hint {
		font-size: 11px;
		color: #666;
	}

	input[type='text'],
	input[type='date'],
	select,
	textarea {
		background: #16213e;
		border: 1px solid #333;
		color: #e0e0e0;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
	}
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #5e60ce;
	}

	.checkbox-label {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: #e0e0e0;
	}

	hr {
		border: none;
		border-top: 1px solid #333;
		margin: 14px 0;
	}

	.relations {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.relation-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.relation-label {
		font-size: 11px;
		text-transform: uppercase;
		color: #888;
		letter-spacing: 0.05em;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		background: #16213e;
		border: 1px solid #444;
		color: #e0e0e0;
		padding: 4px 10px;
		border-radius: 14px;
		cursor: pointer;
		font-size: 13px;
	}
	.chip:hover {
		background: #5e60ce;
		border-color: #5e60ce;
	}

	.rel-entry {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}

	.rel-meta {
		font-size: 11px;
		color: #888;
	}

	.rel-edit {
		background: #16213e;
		border-radius: 4px;
		padding: 8px;
		margin-bottom: 4px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.rel-edit label {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #aaa;
	}

	.rel-edit input[type='date'] {
		flex: 1;
	}

	.add-relatives {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.add-relatives button {
		flex: 1;
		min-width: 140px;
		padding: 8px;
		background: #16213e;
		border: 1px dashed #555;
		color: #aaa;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}
	.add-relatives button:hover {
		border-color: #5e60ce;
		color: #fff;
	}

	.research-section {
		border: 1px solid #333;
		border-radius: 4px;
		padding: 10px;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.research-section legend {
		font-size: 11px;
		text-transform: uppercase;
		color: #888;
		letter-spacing: 0.05em;
		padding: 0 4px;
	}

	.research-entry {
		background: #16213e;
		border-radius: 4px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.research-entry-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.research-entry-num {
		font-size: 11px;
		color: #666;
	}

	.remove-btn {
		background: none;
		border: none;
		color: #888;
		cursor: pointer;
		padding: 0 4px;
		font-size: 14px;
	}
	.remove-btn:hover {
		color: #e74c3c;
	}

	input[type='number'] {
		background: #16213e;
		border: 1px solid #333;
		color: #e0e0e0;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
		width: 80px;
	}
	input[type='number']:focus {
		outline: none;
		border-color: #5e60ce;
	}

	.sources-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.sources-label {
		font-size: 12px;
		color: #aaa;
	}

	.source-row {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.source-row input {
		flex: 1;
	}

	.title-row {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.title-row select {
		width: 100px;
	}
	.title-row input {
		flex: 1;
	}

	.add-inline-btn {
		background: none;
		border: 1px dashed #555;
		color: #aaa;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		align-self: flex-start;
	}
	.add-inline-btn:hover {
		border-color: #5e60ce;
		color: #fff;
	}

	.add-panel {
		width: 100%;
		background: #16213e;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.add-panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.add-panel-title {
		font-size: 14px;
		font-weight: 600;
		text-transform: capitalize;
	}

	.add-search {
		width: 100%;
		background: #1a1a2e;
		border: 1px solid #333;
		color: #e0e0e0;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 14px;
		font-family: inherit;
		box-sizing: border-box;
	}
	.add-search:focus {
		outline: none;
		border-color: #5e60ce;
	}

	.add-results {
		max-height: 200px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.add-result {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: 1px solid transparent;
		color: #e0e0e0;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}
	.add-result:hover {
		background: #5e60ce;
		border-color: #5e60ce;
	}

	.add-no-results {
		font-size: 12px;
		color: #666;
		padding: 4px 0;
	}

	.add-create-btn {
		background: none;
		border: 1px dashed #555;
		color: #aaa;
		padding: 6px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
	}
	.add-create-btn:hover {
		border-color: #5e60ce;
		color: #fff;
	}
</style>
