<script lang="ts">
	import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-svelte';
	import type { PaginationInfo } from '$lib/utils';

	interface Props {
		pagination: PaginationInfo;
		onPageChange: (page: number) => void;
	}

	let { pagination, onPageChange }: Props = $props();

	function goToPage(page: number) {
		if (page >= 1 && page <= pagination.totalPages) {
			onPageChange(page);
		}
	}

	// Generate page numbers to display (with ellipsis for large page counts)
	const visiblePages = $derived(() => {
		const { currentPage, totalPages } = pagination;
		const pages: (number | 'ellipsis')[] = [];

		if (totalPages <= 7) {
			// Show all pages if 7 or fewer
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			if (currentPage > 3) {
				pages.push('ellipsis');
			}

			// Show pages around current page
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (currentPage < totalPages - 2) {
				pages.push('ellipsis');
			}

			// Always show last page
			pages.push(totalPages);
		}

		return pages;
	});
</script>

{#if pagination.totalPages > 1}
	<div
		class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
	>
		<!-- Mobile view -->
		<div class="flex flex-1 justify-between sm:hidden">
			<button
				onclick={() => goToPage(pagination.currentPage - 1)}
				disabled={pagination.currentPage === 1}
				class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Previous
			</button>
			<span class="inline-flex items-center text-sm text-gray-700">
				{pagination.currentPage} / {pagination.totalPages}
			</span>
			<button
				onclick={() => goToPage(pagination.currentPage + 1)}
				disabled={pagination.currentPage === pagination.totalPages}
				class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Next
			</button>
		</div>

		<!-- Desktop view -->
		<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
			<div>
				<p class="text-sm text-gray-700">
					Showing <span class="font-medium">{pagination.startItem}</span> to
					<span class="font-medium">{pagination.endItem}</span> of
					<span class="font-medium">{pagination.totalItems}</span> results
				</p>
			</div>
			<div>
				<nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
					<!-- First page button -->
					<button
						onclick={() => goToPage(1)}
						disabled={pagination.currentPage === 1}
						class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
						title="First page"
					>
						<span class="sr-only">First</span>
						<ChevronsLeft class="h-5 w-5" />
					</button>

					<!-- Previous page button -->
					<button
						onclick={() => goToPage(pagination.currentPage - 1)}
						disabled={pagination.currentPage === 1}
						class="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
						title="Previous page"
					>
						<span class="sr-only">Previous</span>
						<ChevronLeft class="h-5 w-5" />
					</button>

					<!-- Page numbers -->
					{#each visiblePages() as page, index (index)}
						{#if page === 'ellipsis'}
							<span
								class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 ring-inset"
							>
								...
							</span>
						{:else}
							<button
								onclick={() => goToPage(page)}
								class="relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-gray-300 ring-inset focus:z-20 focus:outline-offset-0
									{page === pagination.currentPage
									? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
									: 'text-gray-900 hover:bg-gray-50'}"
							>
								{page}
							</button>
						{/if}
					{/each}

					<!-- Next page button -->
					<button
						onclick={() => goToPage(pagination.currentPage + 1)}
						disabled={pagination.currentPage === pagination.totalPages}
						class="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
						title="Next page"
					>
						<span class="sr-only">Next</span>
						<ChevronRight class="h-5 w-5" />
					</button>

					<!-- Last page button -->
					<button
						onclick={() => goToPage(pagination.totalPages)}
						disabled={pagination.currentPage === pagination.totalPages}
						class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
						title="Last page"
					>
						<span class="sr-only">Last</span>
						<ChevronsRight class="h-5 w-5" />
					</button>
				</nav>
			</div>
		</div>
	</div>
{/if}
