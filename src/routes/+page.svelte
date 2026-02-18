<script>
	import { onMount } from 'svelte';
	import { toFamilyChartData } from '$lib/graph.js';
	import Sidebar from '$lib/Sidebar.svelte';
	import 'family-chart/styles/family-chart.css';

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
			.setCardYSpacing(150);

		const f3Card = chart
			.setCardHtml()
			.setCardDisplay([['first name'], ['birthday']]);

		f3Card.setOnCardClick((e, d) => {
			f3Card.onCardClickDefault(e, d);
			selectedPerson = d.data.id;
		});

		chart
			.updateMainId('timon')
			.updateTree({ initial: true });
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
</style>
