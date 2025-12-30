<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Plus } from 'lucide-svelte';
	import DeckList from '$lib/components/decks/DeckList.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let deleteConfirm = $state<{ isOpen: boolean; id: number | null }>({
		isOpen: false,
		id: null
	});

	function handleDeleteClick(id: number) {
		deleteConfirm = { isOpen: true, id };
	}

	async function handleDeleteConfirm() {
		const idToDelete = deleteConfirm.id;
		deleteConfirm = { isOpen: false, id: null };

		if (idToDelete) {
			try {
				const formData = new FormData();
				formData.append('id', idToDelete.toString());

				const response = await fetch('?/delete', {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					await invalidateAll();
				}
			} catch (error) {
				console.error('Failed to delete deck:', error);
			}
		}
	}

	function handleCloseDialog() {
		deleteConfirm = { isOpen: false, id: null };
	}
</script>

<svelte:head>
	<title>Decks - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Decks</h1>
		<a
			href="/decks/new"
			class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
		>
			<Plus class="mr-2 h-5 w-5" />
			New Deck
		</a>
	</div>

	<DeckList
		decks={data.decks || []}
		onDeleteDeck={handleDeleteClick}
		showTopics={true}
		emptyMessage="No decks"
	/>

	<ConfirmDialog
		isOpen={deleteConfirm.isOpen}
		title="Delete Deck?"
		message="Are you sure you want to delete this deck? This will also delete all associated cards."
		confirmLabel="Delete"
		confirmVariant="danger"
		onClose={handleCloseDialog}
		onConfirm={handleDeleteConfirm}
	/>
</div>
