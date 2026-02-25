<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { toFamilyChartData } from '$lib/graph.js';
	import Sidebar from '$lib/Sidebar.svelte';
	import EncryptedLoader from '$lib/EncryptedLoader.svelte';
	import 'family-chart/styles/family-chart.css';

	const isStatic = import.meta.env.VITE_STATIC === 'true';
	const isEncrypted = import.meta.env.VITE_ENCRYPTED === 'true';
	const { data } = $props();

	// In encrypted mode, persons starts as null until decrypted
	let persons = $state(isEncrypted ? null : data.persons);
	let regions = $state(data.regions || {});
	let chartData = $derived(persons ? toFamilyChartData(persons) : null);
	let selectedPerson = $state('');
	let chart = null;
	let ready = $state(!isEncrypted); // Ready immediately if not encrypted

	function handleEncryptedLoad(decryptedPersons) {
		persons = decryptedPersons;
		ready = true;
	}

	function handleEncryptedError(error) {
		console.error('Encrypted load error:', error);
	}

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

	async function initChart() {
		if (!chartData) return;

		const f3 = await import('family-chart');

		chart = f3.createChart('#FamilyChart', chartData)
			.setTransitionTime(1000)
			.setCardXSpacing(250)
			.setCardYSpacing(150)
			.setShowSiblingsOfMain(true)
			.setSingleParentEmptyCard(!isStatic && !isEncrypted);

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

			// Region accent
			const birthRegion = d.data.data.locations?.birth?.region;
			if (birthRegion && regions[birthRegion]) {
				card.style.borderLeft = `4px solid ${regions[birthRegion].color}`;
			} else {
				card.style.borderLeft = '';
			}

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
	}

	// Initialize chart when ready (either immediately or after encrypted load)
	$effect(() => {
		if (ready && chartData && !chart) {
			initChart();
		}
	});

	// For non-encrypted mode, also initialize on mount
	onMount(() => {
		if (!isEncrypted) {
			initChart();
		}
	});
</script>

{#if isEncrypted && !ready}
	<EncryptedLoader onLoad={handleEncryptedLoad} onError={handleEncryptedError} />
{:else}
	<div class="layout">
		<div id="FamilyChart" class="f3"></div>
		<div class="region-legend">
			{#each Object.entries(regions).filter(([slug]) => Object.values(persons).some(p => p.locations?.birth?.region === slug)) as [slug, region]}
				<div class="legend-item">
					<span class="legend-swatch" style="background: {region.color}"></span>
					<span class="legend-label">{region.name}</span>
				</div>
			{/each}
		</div>
		<Sidebar
			person={selectedPerson}
			{persons}
			{chartData}
			onNavigate={navigateTo}
			onSaved={reloadPersons}
			readonly={isStatic || isEncrypted}
			{regions}
		/>
	</div>
{/if}

<style>
	.layout {
		display: flex;
		position: relative;
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

	:global(.region-legend) {
		position: absolute;
		bottom: 16px;
		left: 16px;
		background: rgba(26, 26, 46, 0.9);
		border: 1px solid #444;
		border-radius: 6px;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		z-index: 10;
		font-size: 11px;
		color: #ccc;
	}

	:global(.legend-item) {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	:global(.legend-swatch) {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		flex-shrink: 0;
	}
</style>
