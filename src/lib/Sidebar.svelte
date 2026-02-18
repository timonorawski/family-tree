<script>
	/**
	 * @type {{ person: any, persons: Record<string, any>, chartData: any[], onNavigate: (slug: string) => void, onSaved: () => void }}
	 */
	let { person, persons, chartData, onNavigate, onSaved } = $props();

	let form = $state({});
	let saving = $state(false);

	// Sync form state when person changes
	$effect(() => {
		if (person) {
			const node = chartData.find((n) => n.id === person);
			if (node) {
				const n = node.data.name || {};
				form = {
					given: (typeof n === 'string' ? n : n.given) || '',
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
					aliases: node.data.aliases ? [...node.data.aliases] : []
				};
			}
		}
	});

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
		const { given, middles, surname_current, surname_birth, research, stories, titles, aliases, ...rest } = form;
		const name = { given };
		const middlesArr = middles ? middles.split(',').map((s) => s.trim()).filter(Boolean) : [];
		if (middlesArr.length) name.middles = middlesArr;
		const surnames = {};
		if (surname_current) surnames.current = surname_current;
		if (surname_birth) surnames.birth = surname_birth;
		if (Object.keys(surnames).length) name.surnames = surnames;

		const payload = { name, ...rest };

		// Preserve relationships from the chart data (not edited via form)
		const node = currentNode();
		if (node) {
			const relationships = [];
			for (const s of node.rels.parents) {
				relationships.push({ type: 'parent', person: s });
			}
			for (const s of node.rels.spouses) {
				relationships.push({ type: 'partner', person: s });
			}
			if (relationships.length) payload.relationships = relationships;
		}

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

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/persons/${person}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload())
			});
			if (res.ok) {
				const result = await res.json();
				await onSaved();
				// If slug changed due to name edit, navigate to the new slug
				if (result.slug !== person) {
					onNavigate(result.slug);
				}
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

	async function deletePerson() {
		if (!confirm(`Delete ${form.given}?`)) return;
		const res = await fetch(`/api/persons/${person}`, { method: 'DELETE' });
		if (res.ok) onSaved();
	}
</script>

{#if person && currentNode()}
	{@const node = currentNode()}
	<aside class="sidebar">
		<header>
			<h2>{form.given || 'Unnamed'}</h2>
			<button class="close-btn" onclick={() => onNavigate('')}>&times;</button>
		</header>

		<form onsubmit={(e) => { e.preventDefault(); save(); }}>
			<label>
				Given name
				<input type="text" bind:value={form.given} />
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

			<div class="actions">
				<button type="submit" class="save-btn" disabled={saving}>
					{saving ? 'Saving...' : 'Save'}
				</button>
				<button type="button" class="delete-btn" onclick={deletePerson}>Delete</button>
			</div>
		</form>

		<hr />

		<section class="relations">
			{#if node.rels.parents.length}
				<div class="relation-group">
					<span class="relation-label">Parents</span>
					<div class="chips">
						{#each node.rels.parents as slug}
							<button class="chip" onclick={() => onNavigate(slug)}>{getName(slug)}</button>
						{/each}
					</div>
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
					<div class="chips">
						{#each node.rels.spouses as slug}
							<button class="chip" onclick={() => onNavigate(slug)}>{getName(slug)}</button>
						{/each}
					</div>
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

		<hr />

		<section class="add-relatives">
			<button onclick={() => addRelative('parent')}>+ Parent</button>
			<button onclick={() => addRelative('sibling')}>+ Sibling</button>
			<button onclick={() => addRelative('partner')}>+ Partner</button>
			<button onclick={() => addRelative('child')}>+ Child</button>
		</section>
	</aside>
{/if}

<style>
	.sidebar {
		width: 360px;
		min-width: 360px;
		height: 100vh;
		overflow-y: auto;
		background: #1a1a2e;
		color: #e0e0e0;
		padding: 16px;
		box-sizing: border-box;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		border-left: 1px solid #333;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: #888;
		font-size: 22px;
		cursor: pointer;
		padding: 0 4px;
	}
	.close-btn:hover {
		color: #fff;
	}

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

	.actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}

	.save-btn {
		flex: 1;
		padding: 8px;
		background: #5e60ce;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}
	.save-btn:hover {
		background: #7b7fd4;
	}
	.save-btn:disabled {
		opacity: 0.5;
	}

	.delete-btn {
		padding: 8px 12px;
		background: #c0392b;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
	}
	.delete-btn:hover {
		background: #e74c3c;
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
</style>
