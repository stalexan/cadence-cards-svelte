<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Plus, Folder } from 'lucide-svelte';
	import TopicList from '$lib/components/topics/TopicList.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let deleteConfirm = $state<{ isOpen: boolean; id: number | null }>({
		isOpen: false,
		id: null
	});

	let isDeleting = $state(false);

	function handleDeleteClick(id: number) {
		deleteConfirm = { isOpen: true, id };
	}

	async function handleDeleteConfirm() {
		const idToDelete = deleteConfirm.id;
		// Close dialog immediately
		deleteConfirm = { isOpen: false, id: null };

		if (idToDelete) {
			isDeleting = true;
			try {
				const formData = new FormData();
				formData.append('id', idToDelete.toString());

				const response = await fetch('?/delete', {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					// Refresh the page data
					await invalidateAll();
				}
			} catch (error) {
				console.error('Failed to delete topic:', error);
			} finally {
				isDeleting = false;
			}
		}
	}

	function handleCloseDialog() {
		deleteConfirm = { isOpen: false, id: null };
	}
</script>

<svelte:head>
	<title>Topics - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Topics</h1>
		<a
			href="/topics/new"
			class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
		>
			<Plus class="mr-2 h-5 w-5" />
			New Topic
		</a>
	</div>

	{#if !data.topics || data.topics.length === 0}
		<EmptyState
			icon={Folder}
			title="No topics"
			description="Get started by creating a new topic."
		/>
	{:else}
		<TopicList topics={data.topics} onDelete={handleDeleteClick} />
	{/if}

	<ConfirmDialog
		isOpen={deleteConfirm.isOpen}
		title="Delete Topic?"
		message="Are you sure you want to delete this topic? This will also delete all associated decks and cards."
		confirmLabel="Delete"
		confirmVariant="danger"
		onClose={handleCloseDialog}
		onConfirm={handleDeleteConfirm}
	/>
</div>
