<script lang="ts">
	import { ArrowLeft, BookOpen } from 'lucide-svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Study - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href="/dashboard" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Dashboard
		</a>
	</div>

	<h1 class="mb-6 text-2xl font-bold text-gray-900">Study with Claude</h1>

	<div class="mb-6 overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<div class="mb-6 text-center">
				<BookOpen class="mx-auto h-12 w-12 text-indigo-500" />
				<h2 class="mt-2 text-lg font-medium text-gray-900">Select a Topic to Study</h2>
				<p class="mt-1 text-sm text-gray-500">
					Choose a topic to start a study session with smart flashcards and AI assistance.
				</p>
			</div>

			{#if !data.topics || data.topics.length === 0}
				<EmptyState
					icon={BookOpen}
					title="No topics available"
					description="Please create a topic first to start studying."
				/>
			{:else}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each data.topics as topic (topic.id)}
						<a
							href={`/study/setup/${topic.id}`}
							class="block rounded-lg border border-gray-200 p-6 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
						>
							<h3 class="text-lg font-medium text-gray-900">{topic.name}</h3>
							<p class="mt-2 text-sm text-gray-500">
								{topic.cardCount}
								{topic.cardCount === 1 ? 'card' : 'cards'} in {topic.deckCount}
								{topic.deckCount === 1 ? 'deck' : 'decks'}
							</p>

							{#if data.topicStats[topic.id]}
								<div class="mt-3 text-xs text-gray-500">
									<div class="flex items-center justify-between">
										<span>Due cards:</span>
										<span class="font-medium">
											{data.topicStats[topic.id].dueCards.total}
										</span>
									</div>
									<div class="mt-1 flex gap-1">
										{#if data.topicStats[topic.id].dueCards.priorityA > 0}
											<span
												class="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
											>
												A: {data.topicStats[topic.id].dueCards.priorityA}
											</span>
										{/if}
										{#if data.topicStats[topic.id].dueCards.priorityB > 0}
											<span
												class="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
											>
												B: {data.topicStats[topic.id].dueCards.priorityB}
											</span>
										{/if}
										{#if data.topicStats[topic.id].dueCards.priorityC > 0}
											<span
												class="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
											>
												C: {data.topicStats[topic.id].dueCards.priorityC}
											</span>
										{/if}
									</div>
								</div>
							{/if}

							<div class="mt-4 text-sm text-indigo-600">Start studying →</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
