<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { ArrowLeft, Pencil, Trash2, RotateCcw, Tag, CheckCircle, XCircle } from 'lucide-svelte';
	import { Priority } from '$lib/sm2';
	import AutoResizingTextarea from '$lib/components/ui/AutoResizingTextarea.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { formatDate } from '$lib/utils';
	import type { ActionData } from './$types';

	interface Props {
		data: {
			card: {
				id: number;
				front: string;
				back: string;
				note: string | null;
				priority: string;
				tags: string[];
				deckId: number;
				deckName: string;
				topicId: number;
				topicName: string;
				version: number;
				isBidirectional: boolean;
				schedules: Array<{
					id: number;
					isReversed: boolean;
					lastSeen: string | null;
					grade: string | null;
					repCount: number;
					easiness: number;
					interval: number;
					version: number;
				}>;
				lastSeen: string | null;
				grade: string | null;
				repCount: number;
				easiness: number;
				interval: number;
				scheduleId: number | null;
				scheduleVersion: number;
			};
			topics: Array<{ id: number; name: string }>;
			decks: Array<{
				id: number;
				name: string;
				topicId: number;
				field1Label?: string;
				field2Label?: string;
			}>;
		};
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Check if edit mode from URL
	let isEditing = $state($page.url.searchParams.get('edit') === 'true');

	// Editable form state - initialize from data but allow local mutations
	function createEditedCard() {
		return {
			front: data.card.front,
			back: data.card.back,
			note: data.card.note || '',
			priority: data.card.priority,
			deckId: data.card.deckId,
			topicId: data.card.topicId,
			tags: [...data.card.tags]
		};
	}
	let editedCard = $state(createEditedCard());

	let tagInput = $state('');
	let deleteConfirm = $state(false);
	let resetProgressConfirm = $state(false);
	let successMessage = $state<string | null>(null);
	let error = $state<string | null>(null);

	// Filtered decks based on selected topic
	let filteredDecks = $derived(data.decks.filter((deck) => deck.topicId === editedCard.topicId));

	// Get current deck info for field labels
	let currentDeck = $derived(data.decks.find((d) => d.id === editedCard.deckId));

	// Get forward schedule for display
	let forwardSchedule = $derived(data.card.schedules.find((s) => !s.isReversed));

	// Handle form success/error from actions
	$effect(() => {
		if (form?.success) {
			successMessage = 'Card updated successfully!';
			isEditing = false;
			invalidateAll();
		}
		if (form?.error) {
			error = form.error;
		}
	});

	function handleTopicChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const newTopicId = parseInt(target.value);
		editedCard.topicId = newTopicId;

		// Reset deck if it's not in the new topic's decks
		const topicDecks = data.decks.filter((d) => d.topicId === newTopicId);
		if (!topicDecks.some((d) => d.id === editedCard.deckId)) {
			editedCard.deckId = topicDecks[0]?.id || 0;
		}
	}

	function handleTagInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && tagInput.trim()) {
			e.preventDefault();
			addTag(tagInput.trim());
		}
	}

	function addTag(tag: string) {
		if (tag && !editedCard.tags.includes(tag)) {
			editedCard.tags = [...editedCard.tags, tag];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		editedCard.tags = editedCard.tags.filter((t) => t !== tag);
	}

	function toggleEdit() {
		if (isEditing) {
			// Cancel editing - reset to original values
			editedCard = createEditedCard();
			error = null;
		}
		isEditing = !isEditing;

		// Update URL
		const url = new URL(window.location.href);
		if (isEditing) {
			url.searchParams.set('edit', 'true');
		} else {
			url.searchParams.delete('edit');
		}
		window.history.replaceState({}, '', url.toString());
	}
</script>

<svelte:head>
	<title>Card Details | Cadence Cards</title>
</svelte:head>

<div class="space-y-6">
	<div class="mb-6">
		<a href="/cards" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Cards
		</a>
	</div>

	<!-- Success Message -->
	{#if successMessage}
		<div class="mb-6 rounded-md bg-green-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<CheckCircle class="h-5 w-5 text-green-400" />
				</div>
				<div class="ml-3">
					<p class="text-sm font-medium text-green-800">{successMessage}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if error}
		<div class="mb-6 rounded-md bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<XCircle class="h-5 w-5 text-red-400" />
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<div class="mt-2 text-sm text-red-700">
						<p>{error}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="flex items-center justify-between px-4 py-5 sm:px-6">
			<h1 class="text-lg font-medium text-gray-900">
				{isEditing ? 'Edit Card' : 'Card Details'}
			</h1>
			<div class="flex space-x-2">
				{#if !isEditing}
					<button
						onclick={toggleEdit}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						<Pencil class="mr-1 h-4 w-4" />
						Edit
					</button>
					<button
						onclick={() => (deleteConfirm = true)}
						class="inline-flex items-center rounded-md border border-transparent bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
					>
						<Trash2 class="mr-1 h-4 w-4" />
						Delete
					</button>
				{:else}
					<button
						onclick={toggleEdit}
						class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				{/if}
			</div>
		</div>

		<div class="border-t border-gray-200">
			{#if isEditing}
				<!-- Edit mode -->
				<form method="POST" action="?/update" use:enhance class="space-y-6 px-4 py-5 sm:p-6">
					<input type="hidden" name="version" value={data.card.version} />

					<!-- Topic and Deck Selection -->
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<label for="topicId" class="mb-1 block text-sm font-medium text-gray-700">
								Topic
							</label>
							<select
								id="topicId"
								name="topicId"
								value={editedCard.topicId}
								onchange={handleTopicChange}
								class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								required
							>
								<option value="">Select a topic</option>
								{#each data.topics as topic (topic.id)}
									<option value={topic.id}>{topic.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="deckId" class="mb-1 block text-sm font-medium text-gray-700">
								Deck
							</label>
							<select
								id="deckId"
								name="deckId"
								bind:value={editedCard.deckId}
								class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
								required
							>
								<option value="">Select a deck</option>
								{#each filteredDecks as deck (deck.id)}
									<option value={deck.id}>{deck.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Front and Back -->
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
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
								rows="5"
								bind:value={editedCard.front}
								class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
								rows="5"
								bind:value={editedCard.back}
								class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								required
							></textarea>
						</div>
					</div>

					<!-- Note -->
					<div>
						<label for="note" class="mb-1 block text-sm font-medium text-gray-700">
							Note (Optional)
						</label>
						<AutoResizingTextarea
							id="note"
							name="note"
							value={editedCard.note}
							placeholder="Additional context or hints"
							minHeight={120}
							class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
						/>
						<p class="mt-1 text-xs text-gray-500">
							This information will be shown after the correct answer is given.
						</p>
					</div>

					<!-- Priority -->
					<fieldset>
						<legend class="mb-2 block text-sm font-medium text-gray-700">Priority</legend>
						<div class="flex space-x-4">
							{#each [{ value: Priority.A, label: 'A (High)' }, { value: Priority.B, label: 'B (Medium)' }, { value: Priority.C, label: 'C (Low)' }] as option (option.value)}
								<div class="flex items-center">
									<input
										id="priority-{option.value}"
										name="priority"
										type="radio"
										value={option.value}
										checked={editedCard.priority === option.value}
										onchange={() => (editedCard.priority = option.value)}
										class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
										required
									/>
									<label for="priority-{option.value}" class="ml-2 block text-sm text-gray-700">
										{option.label}
									</label>
								</div>
							{/each}
						</div>
					</fieldset>

					<!-- Tags -->
					<div>
						<label for="tags" class="mb-1 block text-sm font-medium text-gray-700">
							Tags (Optional)
						</label>
						<div
							class="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-gray-300 p-2"
						>
							{#if editedCard.tags.length > 0}
								{#each editedCard.tags as tag (tag)}
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
							{:else}
								<span class="text-sm text-gray-500">No tags added yet</span>
							{/if}
							<input
								type="text"
								id="tag-input"
								bind:value={tagInput}
								onkeydown={handleTagInputKeyDown}
								onblur={() => tagInput.trim() && addTag(tagInput.trim())}
								class="min-w-0 flex-grow border-0 p-0 text-sm focus:ring-0"
								placeholder="Add tags..."
							/>
						</div>
						<p class="mt-1 text-xs text-gray-500">
							Press Enter to add a tag. Tags can help you organize and filter your cards.
						</p>
					</div>

					<div class="flex justify-end space-x-3 border-t border-gray-200 pt-4">
						<button
							type="button"
							onclick={toggleEdit}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
						>
							Save Changes
						</button>
					</div>
				</form>
			{:else}
				<!-- View mode -->
				<div class="space-y-6 px-4 py-5 sm:p-6">
					<!-- Card context info -->
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div>
							<div class="text-xs font-medium text-gray-500">Topic</div>
							<a
								href="/topics/{data.card.topicId}"
								class="mt-1 text-sm text-indigo-600 hover:text-indigo-900"
							>
								{data.card.topicName}
							</a>
						</div>

						<div>
							<div class="text-xs font-medium text-gray-500">Deck</div>
							<a
								href="/decks/{data.card.deckId}"
								class="mt-1 text-sm text-indigo-600 hover:text-indigo-900"
							>
								{data.card.deckName}
							</a>
						</div>

						<div>
							<div class="text-xs font-medium text-gray-500">Priority</div>
							<span
								class="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {data
									.card.priority === 'A'
									? 'bg-red-100 text-red-800'
									: data.card.priority === 'B'
										? 'bg-yellow-100 text-yellow-800'
										: 'bg-green-100 text-green-800'}"
							>
								{data.card.priority}
							</span>
						</div>

						<div>
							<div class="text-xs font-medium text-gray-500">Last Studied</div>
							<div class="mt-1 text-sm text-gray-900">{formatDate(data.card.lastSeen)}</div>
						</div>
					</div>

					<!-- SM-2 Parameters -->
					<div class="rounded-md bg-gray-50 p-4">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="text-xs font-medium tracking-wider text-gray-500 uppercase">
								SM-2 Parameters
							</h3>
							{#if data.card.schedules.some((s) => s.repCount > 0 || s.lastSeen)}
								<form method="POST" action="?/resetProgress" use:enhance>
									<button
										type="button"
										onclick={() => (resetProgressConfirm = true)}
										class="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
										title="Reset card progress to treat as never studied"
									>
										<RotateCcw class="mr-1 h-3 w-3" />
										Reset Progress
									</button>
								</form>
							{/if}
						</div>

						<!-- Forward Schedule -->
						<div class={data.card.isBidirectional ? 'mb-4 border-b border-gray-300 pb-4' : ''}>
							{#if data.card.isBidirectional}
								<h4 class="mb-2 text-xs font-medium text-gray-600">Forward (Front → Back)</h4>
							{/if}
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div>
									<div class="text-xs font-medium text-gray-500">Grade</div>
									<div class="mt-1 text-sm text-gray-900">
										{forwardSchedule?.grade || 'Not graded yet'}
									</div>
								</div>
								<div>
									<div class="text-xs font-medium text-gray-500">Repetitions</div>
									<div class="mt-1 text-sm text-gray-900">{forwardSchedule?.repCount ?? 0}</div>
								</div>
								<div>
									<div class="text-xs font-medium text-gray-500">Easiness</div>
									<div class="mt-1 text-sm text-gray-900">
										{(forwardSchedule?.easiness ?? 2.5).toFixed(2)}
									</div>
								</div>
								<div>
									<div class="text-xs font-medium text-gray-500">Interval (days)</div>
									<div class="mt-1 text-sm text-gray-900">{forwardSchedule?.interval ?? 1}</div>
								</div>
							</div>
							{#if data.card.isBidirectional}
								<div class="mt-2 text-xs text-gray-500">
									Last studied: {formatDate(forwardSchedule?.lastSeen ?? null)}
								</div>
							{/if}
						</div>

						<!-- Reversed Schedule - only if bidirectional -->
						{#if data.card.isBidirectional}
							{@const reversedSchedule = data.card.schedules.find((s) => s.isReversed)}
							<div>
								<h4 class="mb-2 text-xs font-medium text-gray-600">Reversed (Back → Front)</h4>
								<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
									<div>
										<div class="text-xs font-medium text-gray-500">Grade</div>
										<div class="mt-1 text-sm text-gray-900">
											{reversedSchedule?.grade || 'Not graded yet'}
										</div>
									</div>
									<div>
										<div class="text-xs font-medium text-gray-500">Repetitions</div>
										<div class="mt-1 text-sm text-gray-900">
											{reversedSchedule?.repCount ?? 0}
										</div>
									</div>
									<div>
										<div class="text-xs font-medium text-gray-500">Easiness</div>
										<div class="mt-1 text-sm text-gray-900">
											{(reversedSchedule?.easiness ?? 2.5).toFixed(2)}
										</div>
									</div>
									<div>
										<div class="text-xs font-medium text-gray-500">Interval (days)</div>
										<div class="mt-1 text-sm text-gray-900">
											{reversedSchedule?.interval ?? 1}
										</div>
									</div>
								</div>
								<div class="mt-2 text-xs text-gray-500">
									Last studied: {formatDate(reversedSchedule?.lastSeen ?? null)}
								</div>
							</div>
						{/if}
					</div>

					<!-- Card content -->
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div class="rounded-md border border-gray-200 bg-white p-4">
							<h3 class="mb-2 text-sm font-medium text-gray-900">Front</h3>
							<div class="text-sm whitespace-pre-wrap text-gray-600">{data.card.front}</div>
						</div>

						<div class="rounded-md border border-gray-200 bg-white p-4">
							<h3 class="mb-2 text-sm font-medium text-gray-900">Back</h3>
							<div class="text-sm whitespace-pre-wrap text-gray-600">{data.card.back}</div>
						</div>
					</div>

					<!-- Note -->
					{#if data.card.note}
						<div class="rounded-md border border-yellow-200 bg-yellow-50 p-4">
							<h3 class="mb-2 text-sm font-medium text-yellow-800">Note</h3>
							<div class="text-sm whitespace-pre-wrap text-yellow-700">{data.card.note}</div>
						</div>
					{/if}

					<!-- Tags -->
					<div>
						<h3 class="mb-2 text-sm font-medium text-gray-900">Tags</h3>
						<div class="flex flex-wrap gap-2">
							{#if data.card.tags.length > 0}
								{#each data.card.tags as tag (tag)}
									<span
										class="inline-flex items-center rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800"
									>
										<Tag class="mr-1 h-3 w-3" />
										{tag}
									</span>
								{/each}
							{:else}
								<span class="text-sm text-gray-500">No tags</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<ConfirmDialog
		isOpen={deleteConfirm}
		onClose={() => (deleteConfirm = false)}
		onConfirm={async () => {
			deleteConfirm = false;
			try {
				const response = await fetch('?/delete', {
					method: 'POST',
					body: new FormData()
				});
				if (response.ok) {
					window.location.href = '/cards';
				}
			} catch (error) {
				console.error('Failed to delete card:', error);
			}
		}}
		title="Delete Card?"
		message="Are you sure you want to delete this card? This action cannot be undone."
		confirmLabel="Delete"
		confirmVariant="danger"
	/>

	<ConfirmDialog
		isOpen={resetProgressConfirm}
		onClose={() => (resetProgressConfirm = false)}
		onConfirm={async () => {
			resetProgressConfirm = false;
			try {
				const response = await fetch('?/resetProgress', {
					method: 'POST',
					body: new FormData()
				});
				if (response.ok) {
					await invalidateAll();
				}
			} catch (error) {
				console.error('Failed to reset progress:', error);
			}
		}}
		title="Reset Card Progress?"
		message="Are you sure you want to reset this card's progress? This will reset all SM-2 parameters and treat the card as never studied. This action cannot be undone."
		confirmLabel="Reset Progress"
		confirmVariant="warning"
	/>
</div>
