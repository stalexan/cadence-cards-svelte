<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	interface Topic {
		id: number;
		name: string;
	}

	interface DeckData {
		id?: number;
		name: string;
		topicId: number;
		field1Label?: string | null;
		field2Label?: string | null;
		isBidirectional?: boolean;
	}

	interface Props {
		initialData?: DeckData;
		topics: Topic[];
		cancelHref?: string;
		error?: string | null;
		isEditing?: boolean;
	}

	let {
		initialData = { name: '', topicId: 0 },
		topics,
		cancelHref = '/decks',
		error = null,
		isEditing = false
	}: Props = $props();

	let isSubmitting = $state(false);
</script>

<form
	method="POST"
	class="space-y-6"
	use:enhance={() => {
		isSubmitting = true;
		return async ({ result }) => {
			isSubmitting = false;
			if (result.type === 'redirect') {
				goto(result.location);
			}
		};
	}}
>
	{#if error}
		<div class="rounded-md bg-red-50 p-4">
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
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<div class="mt-2 text-sm text-red-700">
						<p>{error}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="mb-6">
		<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Deck Name</label>
		<input
			type="text"
			id="name"
			name="name"
			value={initialData.name}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., Vocabulary, Verbs, Grammar"
			required
			disabled={isSubmitting}
		/>
	</div>

	<div class="mb-6">
		<label for="topicId" class="mb-1 block text-sm font-medium text-gray-700">Topic</label>
		{#if topics.length === 0}
			<div class="text-sm text-gray-500">
				No topics available. Please
				<a href="/topics/new" class="text-indigo-600 hover:text-indigo-900">create a topic</a>
				first.
			</div>
		{:else}
			<select
				id="topicId"
				name="topicId"
				value={initialData.topicId || ''}
				class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-sans shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
				required
				disabled={isSubmitting || isEditing}
			>
				<option value="">Select a topic</option>
				{#each topics as topic (topic.id)}
					<option value={topic.id}>{topic.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	<div class="mb-6">
		<label for="field1Label" class="mb-1 block text-sm font-medium text-gray-700"
			>Front Side Label (Optional)</label
		>
		<input
			type="text"
			id="field1Label"
			name="field1Label"
			value={initialData.field1Label ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., English, Question, Term"
			disabled={isSubmitting}
		/>
		<p class="mt-1 text-xs text-gray-500">Label for the front/question side of cards</p>
	</div>

	<div class="mb-6">
		<label for="field2Label" class="mb-1 block text-sm font-medium text-gray-700"
			>Back Side Label (Optional)</label
		>
		<input
			type="text"
			id="field2Label"
			name="field2Label"
			value={initialData.field2Label ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., Spanish, Answer, Definition"
			disabled={isSubmitting}
		/>
		<p class="mt-1 text-xs text-gray-500">Label for the back/answer side of cards</p>
	</div>

	<div class="mb-6">
		<div class="flex items-start">
			<div class="flex h-5 items-center">
				<input
					id="isBidirectional"
					name="isBidirectional"
					type="checkbox"
					checked={initialData.isBidirectional ?? false}
					class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
					disabled={isSubmitting}
				/>
			</div>
			<div class="ml-3 text-sm">
				<label for="isBidirectional" class="font-medium text-gray-700">Bidirectional Study</label>
				<p class="text-gray-500">Study cards in both directions (front→back and back→front)</p>
			</div>
		</div>
	</div>

	<div class="flex justify-end space-x-3">
		<a
			href={cancelHref}
			class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
		>
			Cancel
		</a>
		<button
			type="submit"
			disabled={isSubmitting || topics.length === 0}
			class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
		>
			{#if isSubmitting}
				{isEditing ? 'Saving...' : 'Creating...'}
			{:else}
				{isEditing ? 'Save Changes' : 'Create Deck'}
			{/if}
		</button>
	</div>
</form>
