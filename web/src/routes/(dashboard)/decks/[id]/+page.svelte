<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import {
		ArrowLeft,
		Plus,
		Pencil,
		Trash2,
		BookOpen,
		FileText,
		Share2,
		Filter,
		RotateCcw,
		Eye,
		ArrowUp,
		ArrowDown
	} from 'lucide-svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ShareModal from '$lib/components/decks/ShareModal.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { getPaginationInfo } from '$lib/utils';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Filter state
	let searchTerm = $state('');
	let selectedPriority = $state('');
	let selectedTag = $state('');

	// Reset to page 1 when filters change
	$effect(() => {
		// Access the filter values to track them
		searchTerm;
		selectedPriority;
		selectedTag;
		currentPage = 1;
	});

	// Sort state
	type SortColumn = 'front' | 'back' | 'priority' | 'lastSeen';
	type SortDirection = 'asc' | 'desc';
	let sortColumn = $state<SortColumn>('front');
	let sortDirection = $state<SortDirection>('asc');

	function toggleSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	// Pagination state
	const ITEMS_PER_PAGE = 25;
	let currentPage = $state(1);

	let deleteConfirm = $state(false);
	let deleteCardConfirm = $state<{ isOpen: boolean; id: number | null }>({
		isOpen: false,
		id: null
	});
	let showShareModal = $state(false);

	// Get unique tags from all cards in this deck
	const availableTags = $derived(() => {
		const tags = new Set<string>();
		for (const card of data.cards || []) {
			for (const tag of card.tags || []) {
				tags.add(tag);
			}
		}
		return Array.from(tags).sort();
	});

	// Filtered and sorted cards
	const filteredCards = $derived(() => {
		let filtered = [...(data.cards || [])];

		if (searchTerm) {
			const lower = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(card) =>
					card.front?.toLowerCase().includes(lower) ||
					card.back?.toLowerCase().includes(lower) ||
					card.note?.toLowerCase().includes(lower)
			);
		}

		if (selectedPriority) {
			filtered = filtered.filter((card) => card.priority === selectedPriority);
		}

		if (selectedTag) {
			filtered = filtered.filter((card) => card.tags?.includes(selectedTag));
		}

		// Sort the filtered cards
		filtered.sort((a, b) => {
			let comparison = 0;

			switch (sortColumn) {
				case 'front':
					comparison = (a.front || '').localeCompare(b.front || '');
					break;
				case 'back':
					comparison = (a.back || '').localeCompare(b.back || '');
					break;
				case 'priority':
					// Priority A < B < C (alphabetical works)
					comparison = (a.priority || 'C').localeCompare(b.priority || 'C');
					break;
				case 'lastSeen':
					// Handle null values - cards never seen go to the end
					const aDate = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
					const bDate = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
					comparison = aDate - bDate;
					break;
			}

			return sortDirection === 'asc' ? comparison : -comparison;
		});

		return filtered;
	});

	// Pagination computed values
	const paginationInfo = $derived(() => {
		return getPaginationInfo(currentPage, filteredCards().length, ITEMS_PER_PAGE);
	});

	const paginatedCards = $derived(() => {
		const info = paginationInfo();
		const startIndex = info.startItem - 1; // Convert to 0-based index
		const endIndex = info.endItem;
		return filteredCards().slice(startIndex, endIndex);
	});

	function handlePageChange(page: number) {
		currentPage = page;
	}

	function resetFilters() {
		searchTerm = '';
		selectedPriority = '';
		selectedTag = '';
		currentPage = 1; // Reset to first page when filters change
	}

	function formatDate(date: string | Date): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatShortDate(date: string | Date | null): string {
		if (!date) return 'Never';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: '2-digit'
		});
	}

	function truncateText(text: string, maxLength: number = 50): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}

	function handleDeleteCardClick(id: number) {
		deleteCardConfirm = { isOpen: true, id };
	}

	async function handleDeleteDeckConfirm() {
		deleteConfirm = false;

		try {
			const response = await fetch('?/delete', {
				method: 'POST',
				body: new FormData()
			});

			if (response.ok) {
				await goto('/decks');
			}
		} catch (error) {
			console.error('Failed to delete deck:', error);
		}
	}

	async function handleDeleteCardConfirm() {
		const idToDelete = deleteCardConfirm.id;
		deleteCardConfirm = { isOpen: false, id: null };

		if (idToDelete) {
			try {
				const formData = new FormData();
				formData.append('cardId', idToDelete.toString());

				const response = await fetch('?/deleteCard', {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					await invalidateAll();
				}
			} catch (error) {
				console.error('Failed to delete card:', error);
			}
		}
	}
</script>

<svelte:head>
	<title>{data.deck.name} - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href="/decks" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Decks
		</a>
	</div>

	<div class="mb-6 overflow-hidden rounded-lg bg-white shadow">
		<div class="flex items-center justify-between px-4 py-5 sm:px-6">
			<div>
				<h1 class="text-xl font-bold text-gray-900">{data.deck.name}</h1>
				<p class="mt-1 text-sm text-gray-500">
					Created on {formatDate(data.deck.createdAt)}
				</p>
				<a
					href={`/topics/${data.deck.topicId}`}
					class="text-sm text-indigo-600 hover:text-indigo-900"
				>
					{data.deck.topicName}
				</a>
			</div>
			<div class="flex space-x-2">
				<button
					onclick={() => (showShareModal = true)}
					class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700"
					title="Share deck as YAML"
				>
					<Share2 class="mr-1 h-4 w-4" />
					Share Deck
				</button>
				<a
					href={`/study/setup/${data.deck.topicId}?deckId=${data.deck.id}`}
					class="inline-flex items-center rounded-md border border-transparent bg-green-100 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-200"
				>
					<BookOpen class="mr-1 h-4 w-4" />
					Study
				</a>
				<a
					href={`/decks/${data.deck.id}/edit`}
					class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					<Pencil class="mr-1 h-4 w-4" />
					Edit
				</a>
				<button
					onclick={() => (deleteConfirm = true)}
					class="inline-flex items-center rounded-md border border-transparent bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
				>
					<Trash2 class="mr-1 h-4 w-4" />
					Delete
				</button>
			</div>
		</div>

		<!-- Deck Settings -->
		<div class="border-t border-gray-200 px-4 py-5 sm:p-6">
			<h2 class="mb-4 text-lg font-medium text-gray-900">Deck Settings</h2>
			<dl class="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
				<div>
					<dt class="text-sm font-medium text-gray-500">Front Label</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{data.deck.field1Label || 'Default'}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Back Label</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{data.deck.field2Label || 'Default'}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Bidirectional</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{data.deck.isBidirectional ? 'Yes' : 'No'}
					</dd>
				</div>
			</dl>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-6 overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="flex items-center text-lg font-medium text-gray-900">
					<Filter class="mr-2 h-5 w-5 text-gray-500" />
					Filters
				</h2>
				<button
					onclick={resetFilters}
					class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
				>
					<RotateCcw class="mr-1 h-4 w-4" />
					Reset
				</button>
			</div>

			<div class="flex flex-col gap-4 sm:flex-row">
				<!-- Search - grows to fill available space -->
				<div class="flex-1">
					<label for="search" class="mb-1 block text-sm font-medium text-gray-700">Search</label>
					<input
						type="text"
						id="search"
						placeholder="Search front, back, note..."
						bind:value={searchTerm}
						class="block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					/>
				</div>

				<!-- Priority Filter - fixed width -->
				<div class="w-full sm:w-40">
					<label for="priority" class="mb-1 block text-sm font-medium text-gray-700">Priority</label
					>
					<select
						id="priority"
						bind:value={selectedPriority}
						class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-sans shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
					>
						<option value="">All Priorities</option>
						<option value="A">Priority A</option>
						<option value="B">Priority B</option>
						<option value="C">Priority C</option>
					</select>
				</div>

				<!-- Tag Filter - fixed width -->
				<div class="w-full sm:w-40">
					<label for="tag" class="mb-1 block text-sm font-medium text-gray-700">Tag</label>
					<select
						id="tag"
						bind:value={selectedTag}
						class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-sans shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
					>
						<option value="">All Tags</option>
						{#each availableTags() as tag (tag)}
							<option value={tag}>{tag}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-lg font-medium text-gray-900">
					Cards ({filteredCards().length}{data.cards?.length !== filteredCards().length
						? ` of ${data.cards?.length}`
						: ''})
				</h2>
				<a
					href={`/cards/new?deckId=${data.deck.id}`}
					class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
				>
					<Plus class="mr-2 h-5 w-5" />
					Add Card
				</a>
			</div>

			{#if !data.cards || data.cards.length === 0}
				<div class="py-12 text-center">
					<FileText class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900">No cards yet</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by adding a new card.</p>
					<div class="mt-6">
						<a
							href={`/cards/new?deckId=${data.deck.id}`}
							class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
						>
							<Plus class="mr-2 h-5 w-5" />
							Add Card
						</a>
					</div>
				</div>
			{:else if filteredCards().length === 0}
				<div class="py-12 text-center">
					<h3 class="text-sm font-medium text-gray-900">No cards match your filter criteria</h3>
					<p class="mt-1 text-sm text-gray-500">Try adjusting your filters.</p>
					<div class="mt-6">
						<button
							onclick={resetFilters}
							class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
						>
							<RotateCcw class="mr-2 h-5 w-5" />
							Reset Filters
						</button>
					</div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									scope="col"
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									<button
										onclick={() => toggleSort('front')}
										class="inline-flex items-center gap-1 hover:text-gray-700"
									>
										{data.deck.field1Label || 'Front'}
										{#if sortColumn === 'front'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th
									scope="col"
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									<button
										onclick={() => toggleSort('back')}
										class="inline-flex items-center gap-1 hover:text-gray-700"
									>
										{data.deck.field2Label || 'Back'}
										{#if sortColumn === 'back'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th
									scope="col"
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									<button
										onclick={() => toggleSort('priority')}
										class="inline-flex items-center gap-1 hover:text-gray-700"
									>
										Priority
										{#if sortColumn === 'priority'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th
									scope="col"
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									<button
										onclick={() => toggleSort('lastSeen')}
										class="inline-flex items-center gap-1 hover:text-gray-700"
									>
										Last Seen
										{#if sortColumn === 'lastSeen'}
											{#if sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
										{/if}
									</button>
								</th>
								<th
									scope="col"
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									Tags
								</th>
								<th
									scope="col"
									class="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#each paginatedCards() as card (card.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-3 text-sm text-gray-900" title={card.front}>
										{truncateText(card.front)}
									</td>
									<td class="px-4 py-3 text-sm text-gray-900" title={card.back}>
										{truncateText(card.back)}
									</td>
									<td class="px-4 py-3 text-sm">
										<span
											class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
											{card.priority === 'A'
												? 'bg-red-100 text-red-800'
												: card.priority === 'B'
													? 'bg-yellow-100 text-yellow-800'
													: 'bg-green-100 text-green-800'}"
										>
											{card.priority}
										</span>
									</td>
									<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-500">
										{formatShortDate(card.lastSeen)}
									</td>
									<td class="px-4 py-3 text-sm">
										{#if card.tags && card.tags.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each card.tags.slice(0, 3) as tag (tag)}
													<span
														class="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
													>
														{tag}
													</span>
												{/each}
												{#if card.tags.length > 3}
													<span class="text-xs text-gray-500">+{card.tags.length - 3}</span>
												{/if}
											</div>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-right text-sm whitespace-nowrap">
										<div class="flex items-center justify-end space-x-2">
											<a
												href={`/cards/${card.id}`}
												class="inline-flex items-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
												title="View"
											>
												<Eye class="h-4 w-4" />
											</a>
											<a
												href={`/cards/${card.id}?edit=true`}
												class="inline-flex items-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
												title="Edit"
											>
												<Pencil class="h-4 w-4" />
											</a>
											<button
												onclick={() => handleDeleteCardClick(card.id)}
												class="inline-flex items-center rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
												title="Delete"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				<Pagination pagination={paginationInfo()} onPageChange={handlePageChange} />
			{/if}
		</div>
	</div>

	<ConfirmDialog
		isOpen={deleteConfirm}
		title="Delete Deck?"
		message="Are you sure you want to delete this deck? This will also delete all associated cards."
		confirmLabel="Delete"
		confirmVariant="danger"
		onClose={() => (deleteConfirm = false)}
		onConfirm={handleDeleteDeckConfirm}
	/>

	<ConfirmDialog
		isOpen={deleteCardConfirm.isOpen}
		title="Delete Card?"
		message="Are you sure you want to delete this card?"
		confirmLabel="Delete"
		confirmVariant="danger"
		onClose={() => (deleteCardConfirm = { isOpen: false, id: null })}
		onConfirm={handleDeleteCardConfirm}
	/>

	<ShareModal
		isOpen={showShareModal}
		onClose={() => (showShareModal = false)}
		deckName={data.deck.name}
		deckId={data.deck.id}
	/>
</div>
