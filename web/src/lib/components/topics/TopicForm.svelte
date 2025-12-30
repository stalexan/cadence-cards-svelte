<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';

	interface TopicData {
		id?: number;
		name: string;
		topicDescription?: string | null;
		expertise?: string | null;
		focus?: string | null;
		contextType?: string | null;
		example?: string | null;
		question?: string | null;
	}

	interface Props {
		initialData?: TopicData;
		cancelHref?: string;
		error?: string | null;
	}

	let { initialData, cancelHref = '/topics', error = null }: Props = $props();

	let isSubmitting = $state(false);
	const isEditing = $derived(!!initialData?.id);
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
					<h3 class="text-sm font-medium text-red-800">
						{isEditing ? 'Error updating topic' : 'Error creating topic'}
					</h3>
					<div class="mt-2 text-sm text-red-700">
						<p>{error}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="mb-6">
		<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Topic Name</label>
		<input
			type="text"
			id="name"
			name="name"
			value={initialData?.name ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., Spanish, Mathematics, History"
			required
			disabled={isSubmitting}
		/>
	</div>

	<div class="mb-6">
		<label for="topicDescription" class="mb-1 block text-sm font-medium text-gray-700"
			>Topic Description</label
		>
		<input
			type="text"
			id="topicDescription"
			name="topicDescription"
			value={initialData?.topicDescription ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., Mexican Spanish, Elementary Algebra"
			disabled={isSubmitting}
		/>
		<p class="mt-1 text-xs text-gray-500">A more specific description of the topic area.</p>
	</div>

	<div class="mb-6">
		<label for="expertise" class="mb-1 block text-sm font-medium text-gray-700">Expertise</label>
		<input
			type="text"
			id="expertise"
			name="expertise"
			value={initialData?.expertise ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., tutor, language tutor, math tutor"
			disabled={isSubmitting}
		/>
		<p class="mt-1 text-xs text-gray-500">The role Claude should take when tutoring this topic.</p>
	</div>

	<div class="mb-6">
		<label for="focus" class="mb-1 block text-sm font-medium text-gray-700">Focus</label>
		<input
			type="text"
			id="focus"
			name="focus"
			value={initialData?.focus ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., concepts and principles, vocabulary and grammar"
			disabled={isSubmitting}
		/>
		<p class="mt-1 text-xs text-gray-500">What aspects of the topic to emphasize in tutoring.</p>
	</div>

	<div class="mb-6">
		<label for="contextType" class="mb-1 block text-sm font-medium text-gray-700"
			>Context Type</label
		>
		<input
			type="text"
			id="contextType"
			name="contextType"
			value={initialData?.contextType ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="e.g., additional context, cultural context, practical applications"
			disabled={isSubmitting}
		/>
		<p class="mt-1 text-xs text-gray-500">
			What kind of additional information Claude should provide during tutoring.
		</p>
	</div>

	<div class="mb-6">
		<label for="example" class="mb-1 block text-sm font-medium text-gray-700">Examples</label>
		<textarea
			id="example"
			name="example"
			value={initialData?.example ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="Provide examples of concepts, explanations, or question-answer pairs for this topic."
			rows={10}
			disabled={isSubmitting}
		></textarea>
		<p class="mt-1 text-xs text-gray-500">
			Simplified examples to help Claude understand how to tutor this topic.
		</p>
	</div>

	<div class="mb-6">
		<label for="question" class="mb-1 block text-sm font-medium text-gray-700"
			>Question Prompt</label
		>
		<textarea
			id="question"
			name="question"
			value={initialData?.question ?? ''}
			class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			placeholder="Custom prompt for generating questions from flashcards. Leave blank to use the default."
			rows={10}
			disabled={isSubmitting}
		></textarea>
		<p class="mt-1 text-xs text-gray-500">
			Customize how questions are generated from flashcards. The card content will be automatically
			added at the end.
		</p>
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
			disabled={isSubmitting}
			class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
		>
			{#if isSubmitting}
				{isEditing ? 'Saving...' : 'Creating...'}
			{:else}
				{isEditing ? 'Save Changes' : 'Create Topic'}
			{/if}
		</button>
	</div>
</form>
