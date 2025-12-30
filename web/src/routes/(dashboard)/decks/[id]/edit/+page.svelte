<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import DeckForm from '$lib/components/decks/DeckForm.svelte';
	import type { PageData, ActionData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
</script>

<svelte:head>
	<title>Edit {data.deck.name} - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a
			href={`/decks/${data.deck.id}`}
			class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
		>
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Deck
		</a>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<h1 class="mb-6 text-xl font-semibold text-gray-900">Edit Deck</h1>

			<DeckForm
				initialData={data.deck}
				topics={data.topics}
				cancelHref={`/decks/${data.deck.id}`}
				error={form?.error}
				isEditing={true}
			/>
		</div>
	</div>
</div>
