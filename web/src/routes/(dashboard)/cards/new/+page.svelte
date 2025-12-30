<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { ArrowLeft } from 'lucide-svelte';
	import { Priority } from '$lib/sm2';
	import AutoResizingTextarea from '$lib/components/ui/AutoResizingTextarea.svelte';
	import type { ActionData } from './$types';

	interface Props {
		data: {
			topics: Array<{ id: number; name: string }>;
			decks: Array<{
				id: number;
				name: string;
				topicId: number;
				field1Label?: string;
				field2Label?: string;
			}>;
			initialDeckId: number | null;
			initialTopicId: number | null;
		};
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Form state
	let front = $state('');
	let back = $state('');
	let note = $state('');
	let priority = $state<string>(Priority.A);
	let tags = $state<string[]>([]);
	let tagInput = $state('');
	let topicId = $state(untrack(() => data.initialTopicId) || 0);
	let deckId = $state(untrack(() => data.initialDeckId) || 0);
	let isSubmitting = $state(false);

	// Filtered decks based on selected topic
	let filteredDecks = $derived(data.decks.filter((deck) => deck.topicId === topicId));

	// Get current deck info for field labels
	let currentDeck = $derived(data.decks.find((d) => d.id === deckId));

	function handleTopicChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newTopicId = parseInt(target.value);
		topicId = newTopicId;

		// Reset deck if it's not in the new topic's decks
		const topicDecks = data.decks.filter((d) => d.topicId === newTopicId);
		if (!topicDecks.some((d) => d.id === deckId)) {
			deckId = topicDecks[0]?.id || 0;
		}
	}

	function handleTagInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && tagInput.trim()) {
			e.preventDefault();
			addTag(tagInput.trim());
		}
	}

	function addTag(tag: string) {
		if (tag && !tags.includes(tag)) {
			tags = [...tags, tag];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}
</script>

<svelte:head>
	<title>Create New Card | Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a
			href={deckId ? `/decks/${deckId}` : '/cards'}
			class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
		>
			<ArrowLeft class="mr-1 h-4 w-4" />
			{deckId ? 'Back to Deck' : 'Back to Cards'}
		</a>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<h1 class="mb-6 text-xl font-semibold text-gray-900">Create New Card</h1>

			{#if form?.error}
				<div class="mb-6 rounded-md bg-red-50 p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-red-800">Error creating card</h3>
							<div class="mt-2 text-sm text-red-700">
								<p>{form.error}</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
			>
				<!-- Topic and Deck Selection -->
				<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="topicId" class="mb-1 block text-sm font-medium text-gray-700">
							Topic
						</label>
						{#if data.topics.length === 0}
							<div class="text-sm text-gray-500">
								No topics available. Please
								<a href="/topics/new" class="text-indigo-600 hover:text-indigo-900">
									create a topic
								</a>
								first.
							</div>
						{:else}
							<select
								id="topicId"
								name="topicId"
								value={topicId}
								onchange={handleTopicChange}
								class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								required
							>
								<option value="">Select a topic</option>
								{#each data.topics as topic (topic.id)}
									<option value={topic.id}>{topic.name}</option>
								{/each}
							</select>
						{/if}
					</div>

					<div>
						<label for="deckId" class="mb-1 block text-sm font-medium text-gray-700"> Deck </label>
						{#if !topicId}
							<div class="text-sm text-gray-500">Please select a topic first</div>
						{:else if filteredDecks.length === 0}
							<div class="text-sm text-gray-500">
								No decks available for this topic. Please
								<a
									href="/decks/new?topicId={topicId}"
									class="text-indigo-600 hover:text-indigo-900"
								>
									create a deck
								</a>
								first.
							</div>
						{:else}
							<select
								id="deckId"
								name="deckId"
								bind:value={deckId}
								class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								required
							>
								<option value="">Select a deck</option>
								{#each filteredDecks as deck (deck.id)}
									<option value={deck.id}>{deck.name}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>

				<!-- Front and Back -->
				<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
					<div>
						<label for="front" class="mb-1 block text-sm font-medium text-gray-700">
							Front
							{#if currentDeck?.field1Label}
								<span class="font-normal text-gray-500">({currentDeck.field1Label})</span>
							{/if}
						</label>
						<textarea
							id="front"
							name="front"
							rows="4"
							bind:value={front}
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							placeholder="Question or prompt"
							required
						></textarea>
					</div>

					<div>
						<label for="back" class="mb-1 block text-sm font-medium text-gray-700">
							Back
							{#if currentDeck?.field2Label}
								<span class="font-normal text-gray-500">({currentDeck.field2Label})</span>
							{/if}
						</label>
						<textarea
							id="back"
							name="back"
							rows="4"
							bind:value={back}
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							placeholder="Answer"
							required
						></textarea>
					</div>
				</div>

				<!-- Note -->
				<div class="mb-6">
					<label for="note" class="mb-1 block text-sm font-medium text-gray-700">
						Note (Optional)
					</label>
					<AutoResizingTextarea
						id="note"
						name="note"
						value={note}
						placeholder="Additional context or hints"
						minHeight={120}
						class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					/>
					<p class="mt-1 text-xs text-gray-500">
						This information will be shown after the correct answer is given.
					</p>
				</div>

				<!-- Priority -->
				<fieldset class="mb-6">
					<legend class="mb-2 block text-sm font-medium text-gray-700">Priority</legend>
					<div class="flex space-x-4">
						{#each [{ value: Priority.A, label: 'A (High)' }, { value: Priority.B, label: 'B (Medium)' }, { value: Priority.C, label: 'C (Low)' }] as option (option.value)}
							<div class="flex items-center">
								<input
									id="priority-{option.value}"
									name="priority"
									type="radio"
									value={option.value}
									checked={priority === option.value}
									onchange={() => (priority = option.value)}
									class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
								/>
								<label for="priority-{option.value}" class="ml-2 block text-sm text-gray-700">
									{option.label}
								</label>
							</div>
						{/each}
					</div>
				</fieldset>

				<!-- Tags -->
				<div class="mb-6">
					<label for="tags" class="mb-1 block text-sm font-medium text-gray-700">
						Tags (Optional)
					</label>
					<div class="mb-2 flex flex-wrap items-center gap-2">
						{#each tags as tag (tag)}
							<span
								class="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
							>
								{tag}
								<button
									type="button"
									onclick={() => removeTag(tag)}
									class="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-indigo-400 hover:text-indigo-600 focus:outline-none"
								>
									<span class="sr-only">Remove tag {tag}</span>
									<svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
										<path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
									</svg>
								</button>
							</span>
							<input type="hidden" name="tags" value={tag} />
						{/each}
						<input
							type="text"
							id="tag-input"
							bind:value={tagInput}
							onkeydown={handleTagInputKeyDown}
							onblur={() => tagInput.trim() && addTag(tagInput.trim())}
							class="border-0 p-0 text-sm focus:ring-0"
							placeholder={tags.length > 0 ? '' : 'Add tags...'}
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						Press Enter to add a tag. Tags can help you organize and filter your cards.
					</p>
				</div>

				<div class="flex justify-end space-x-3">
					<a
						href={deckId ? `/decks/${deckId}` : '/cards'}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
					>
						Cancel
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
					>
						{isSubmitting ? 'Creating...' : 'Create Card'}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
