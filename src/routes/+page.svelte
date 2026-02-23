<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { toFamilyChartData } from '$lib/graph.js';
	import Sidebar from '$lib/Sidebar.svelte';
	import 'family-chart/styles/family-chart.css';

	const isStatic = import.meta.env.VITE_STATIC === 'true';
	const { data } = $props();

	let persons = $state(data.persons);
	let chartData = $derived(toFamilyChartData(persons));
	let selectedPerson = $state('');
	let chart = null;

	function navigateTo(slug) {
		selectedPerson = slug;
		if (slug && chart) {
			chart.updateMainId(slug).updateTree({ tree_position: 'main_to_middle' });
		}
	}

	async function reloadPersons() {
		const res = await fetch('/api/persons');
		if (res.ok) {
			persons = await res.json();
			if (chart) {
				const newChartData = toFamilyChartData(persons);
				chart.updateData(newChartData).updateTree({ tree_position: 'inherit' });
			}
		}
	}

	onMount(async () => {
		const f3 = await import('family-chart');

		chart = f3.createChart('#FamilyChart', chartData)
			.setTransitionTime(1000)
			.setCardXSpacing(250)
			.setCardYSpacing(150)
			.setShowSiblingsOfMain(true)
			.setSingleParentEmptyCard(!isStatic);

		const f3Card = chart
			.setCardHtml()
			.setCardDisplay([['first name'], ['birthday']])
			.setMiniTree(true);

		f3Card.setOnCardClick((e, d) => {
			f3Card.onCardClickDefault(e, d);
			selectedPerson = d.data.id;
		});

		f3Card.setOnCardUpdate(function (d) {
			const card = this.querySelector('.card');
			if (!card) return;

			const prev = card.querySelector('.hidden-rels-badge');
			if (prev) prev.remove();

			if (d.all_rels_displayed !== false) return;

			const tree = chart.store.getTree();
			if (!tree) return;
			const rendered = new Set(tree.data.map((n) => n.data.id));

			const rels = d.data.rels;
			const hp = (rels.parents || []).filter((id) => !rendered.has(id)).length;
			const hs = (rels.spouses || []).filter((id) => !rendered.has(id)).length;
			const hc = (rels.children || []).filter((id) => !rendered.has(id)).length;

			const parts = [];
			if (hp) parts.push(`+${hp} parent${hp > 1 ? 's' : ''}`);
			if (hs) parts.push(`+${hs} partner${hs > 1 ? 's' : ''}`);
			if (hc) parts.push(`+${hc} ${hc > 1 ? 'children' : 'child'}`);
			if (!parts.length) return;

			const badge = document.createElement('div');
			badge.className = 'hidden-rels-badge';
			badge.textContent = parts.join(', ');
			badge.addEventListener('click', (e) => {
				e.stopPropagation();
				chart.updateMainId(d.data.id).updateTree({ tree_position: 'main_to_middle' });
			});
			card.appendChild(badge);
		});

		const initialPerson = page.url.searchParams.get('person') || 'timon';

		chart
			.updateMainId(initialPerson)
			.updateTree({ initial: true });

		if (initialPerson !== 'timon') {
			selectedPerson = initialPerson;
		}
	});
</script>

<div class="layout">
	<div id="FamilyChart" class="f3"></div>
	<Sidebar
		person={selectedPerson}
		{persons}
		{chartData}
		onNavigate={navigateTo}
		onSaved={reloadPersons}
		readonly={isStatic}
	/>
</div>

<style>
	.layout {
		display: flex;
		width: 100vw;
		height: 100vh;
	}

	:global(#FamilyChart) {
		flex: 1;
		height: 100vh;
		background-color: rgb(33, 33, 33);
		color: #fff;
	}

	:global(.hidden-rels-badge) {
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		background: #5e60ce;
		color: #fff;
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 8px;
		white-space: nowrap;
		cursor: pointer;
		pointer-events: auto;
		opacity: 0.85;
	}

	:global(.hidden-rels-badge:hover) {
		opacity: 1;
	}
</style>
