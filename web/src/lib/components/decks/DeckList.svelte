<script lang="ts">
	import { BookOpen, Plus } from 'lucide-svelte';

	interface Deck {
		id: number;
		name: string;
		topicId: number;
		topicName: string;
		cardCount?: number;
		createdAt: string | Date;
	}

	interface Props {
		decks: Deck[];
		onDeleteDeck?: (id: number) => void;
		showTopics?: boolean;
		emptyMessage?: string;
	}

	let { decks, onDeleteDeck, showTopics = true, emptyMessage = 'No decks found' }: Props = $props();

	let searchTerm = $state('');

	// Filter decks based on search term
	const filteredDecks = $derived(
		decks.filter(
			(deck) =>
				deck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(showTopics && deck.topicName.toLowerCase().includes(searchTerm.toLowerCase()))
		)
	);
</script>

{#if decks.length === 0}
	<div class="rounded-lg bg-white py-12 text-center shadow">
		<BookOpen class="mx-auto h-12 w-12 text-gray-400" />
		<h3 class="mt-2 text-sm font-medium text-gray-900">{emptyMessage}</h3>
		<p class="mt-1 text-sm text-gray-500">Get started by creating a new deck.</p>
		<div class="mt-6">
			<a
				href="/decks/new"
				class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
			>
				<Plus class="mr-2 h-5 w-5" />
				New Deck
			</a>
		</div>
	</div>
{:else}
	<div class="space-y-4">
		<!-- Search Box -->
		<div class="mb-4">
			<input
				type="text"
				placeholder="Search decks..."
				class="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				bind:value={searchTerm}
			/>
		</div>

		<!-- Decks Grid -->
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#if filteredDecks.length === 0}
				<div class="col-span-full py-6 text-center">
					<p class="text-gray-500">No decks match your search criteria</p>
				</div>
			{:else}
				{#each filteredDecks as deck (deck.id)}
					<div class="overflow-hidden rounded-lg bg-white shadow">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0 rounded-md bg-blue-100 p-3">
									<BookOpen class="h-6 w-6 text-blue-600" />
								</div>
								<div class="ml-5 w-0 flex-1">
									<a href={`/decks/${deck.id}`}>
										<h3 class="text-lg font-medium text-gray-900 hover:text-indigo-600">
											{deck.name}
										</h3>
									</a>
									<div class="mt-1 flex flex-col">
										{#if showTopics}
											<a
												href={`/topics/${deck.topicId}`}
												class="text-sm text-indigo-600 hover:text-indigo-900"
											>
												{deck.topicName}
											</a>
										{/if}
										<span class="mt-1 text-sm text-gray-500">
											{deck.cardCount ?? 0}
											{(deck.cardCount ?? 0) === 1 ? 'card' : 'cards'}
										</span>
									</div>
								</div>
							</div>
						</div>
						<div class="flex justify-between bg-gray-50 px-5 py-3">
							<a href={`/decks/${deck.id}`} class="text-sm text-indigo-600 hover:text-indigo-900">
								View details
							</a>
							<div class="flex items-center space-x-2">
								<a
									href={`/study/setup/${deck.topicId}?deckId=${deck.id}`}
									class="text-sm text-green-600 hover:text-green-900"
								>
									Study
								</a>
								<a
									href={`/decks/${deck.id}/edit`}
									class="text-sm text-gray-600 hover:text-gray-900"
								>
									Edit
								</a>
								{#if onDeleteDeck}
									<button
										onclick={() => onDeleteDeck(deck.id)}
										class="text-sm text-red-600 hover:text-red-900"
									>
										Delete
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
