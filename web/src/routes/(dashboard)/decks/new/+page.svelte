<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import DeckForm from '$lib/components/decks/DeckForm.svelte';
	import type { PageData, ActionData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const cancelHref = $derived(data.initialTopicId ? `/topics/${data.initialTopicId}` : '/decks');
</script>

<svelte:head>
	<title>Create Deck - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href={cancelHref} class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			{data.initialTopicId ? 'Back to Topic' : 'Back to Decks'}
		</a>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<h1 class="mb-6 text-xl font-semibold text-gray-900">Create New Deck</h1>

			<DeckForm
				initialData={{
					name: '',
					topicId: data.initialTopicId || 0
				}}
				topics={data.topics}
				{cancelHref}
				error={form?.error}
			/>
		</div>
	</div>
</div>
