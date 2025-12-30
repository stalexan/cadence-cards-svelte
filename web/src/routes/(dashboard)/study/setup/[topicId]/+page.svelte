<script lang="ts">
	import { untrack } from 'svelte';
	import { ArrowLeft, Play } from 'lucide-svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let selectedDeckIds = $state<number[]>(
		untrack(() => (data.initialDeckId ? [data.initialDeckId] : []))
	);
	let selectedPriority = $state('');
	let includeNew = $state(true);
	let cardLimit = $state(20);

	function toggleDeck(deckId: number) {
		if (selectedDeckIds.includes(deckId)) {
			selectedDeckIds = selectedDeckIds.filter((id) => id !== deckId);
		} else {
			selectedDeckIds = [...selectedDeckIds, deckId];
		}
	}

	function selectAllDecks() {
		selectedDeckIds = data.decks.map((d: { id: number }) => d.id);
	}

	function clearDeckSelection() {
		selectedDeckIds = [];
	}

	function buildStudyUrl(): string {
		const params = new URLSearchParams();
		if (selectedDeckIds.length > 0) {
			selectedDeckIds.forEach((id) => params.append('deckIds', id.toString()));
		}
		if (selectedPriority) {
			params.set('priority', selectedPriority);
		}
		params.set('includeNew', includeNew.toString());
		params.set('limit', cardLimit.toString());
		return `/study/${data.topic.id}?${params.toString()}`;
	}
</script>

<svelte:head>
	<title>Study Setup - {data.topic.name} - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href="/study" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Topic Selection
		</a>
	</div>

	<h1 class="mb-2 text-2xl font-bold text-gray-900">Study: {data.topic.name}</h1>
	<p class="mb-6 text-gray-600">Configure your study session</p>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Study Stats -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:p-6">
				<h2 class="mb-4 text-lg font-medium text-gray-900">Due Cards</h2>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-500">Priority A</span>
						<span
							class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
						>
							{data.stats.dueCards.priorityA}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-500">Priority B</span>
						<span
							class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800"
						>
							{data.stats.dueCards.priorityB}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-500">Priority C</span>
						<span
							class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
						>
							{data.stats.dueCards.priorityC}
						</span>
					</div>
					<div class="border-t border-gray-200 pt-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-gray-900">Total Due</span>
							<span class="text-lg font-semibold text-indigo-600">
								{data.stats.dueCards.total}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Deck Selection -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:p-6">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-medium text-gray-900">Select Decks</h2>
					<div class="flex space-x-2">
						<button onclick={selectAllDecks} class="text-xs text-indigo-600 hover:text-indigo-800">
							All
						</button>
						<span class="text-gray-300">|</span>
						<button onclick={clearDeckSelection} class="text-xs text-gray-500 hover:text-gray-700">
							None
						</button>
					</div>
				</div>

				{#if data.decks.length === 0}
					<p class="text-sm text-gray-500">No decks available for this topic.</p>
				{:else}
					<div class="space-y-2">
						{#each data.decks as deck (deck.id)}
							<label class="flex items-center">
								<input
									type="checkbox"
									checked={selectedDeckIds.includes(deck.id)}
									onchange={() => toggleDeck(deck.id)}
									class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
								/>
								<span class="ml-2 text-sm text-gray-700">
									{deck.name}
									<span class="text-gray-400">({deck.cardCount} cards)</span>
								</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Study Options -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:p-6">
				<h2 class="mb-4 text-lg font-medium text-gray-900">Options</h2>

				<div class="space-y-4">
					<!-- Priority Filter -->
					<div>
						<label for="priority" class="mb-1 block text-sm font-medium text-gray-700">
							Priority Filter
						</label>
						<select
							id="priority"
							bind:value={selectedPriority}
							class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						>
							<option value="">All Priorities</option>
							<option value="A">Priority A Only</option>
							<option value="B">Priority B Only</option>
							<option value="C">Priority C Only</option>
						</select>
					</div>

					<!-- Include New Cards -->
					<div class="flex items-center">
						<input
							id="includeNew"
							type="checkbox"
							bind:checked={includeNew}
							class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
						/>
						<label for="includeNew" class="ml-2 text-sm text-gray-700">
							Include new cards (not yet studied)
						</label>
					</div>

					<!-- Card Limit -->
					<div>
						<label for="cardLimit" class="mb-1 block text-sm font-medium text-gray-700">
							Cards per session
						</label>
						<select
							id="cardLimit"
							bind:value={cardLimit}
							class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						>
							<option value={10}>10 cards</option>
							<option value={20}>20 cards</option>
							<option value={30}>30 cards</option>
							<option value={50}>50 cards</option>
							<option value={100}>100 cards</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Start Session Button -->
	<div class="mt-6 flex justify-center">
		<a
			href={buildStudyUrl()}
			class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
		>
			<Play class="mr-2 h-5 w-5" />
			Start Study Session
		</a>
	</div>
</div>
