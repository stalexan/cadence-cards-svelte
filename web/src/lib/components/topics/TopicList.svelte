<script lang="ts">
	import { Folder, Pencil, Plus, Trash2, BookOpen } from 'lucide-svelte';

	interface Topic {
		id: number;
		name: string;
		deckCount: number;
		cardCount: number;
		createdAt: string | Date;
	}

	interface Props {
		topics: Topic[];
		onDelete?: (id: number) => void;
	}

	let { topics, onDelete }: Props = $props();
</script>

{#if topics.length === 0}
	<div class="rounded-lg bg-white py-12 text-center shadow">
		<Folder class="mx-auto h-12 w-12 text-gray-400" />
		<h3 class="mt-2 text-sm font-medium text-gray-900">No topics</h3>
		<p class="mt-1 text-sm text-gray-500">Get started by creating a new topic.</p>
		<div class="mt-6">
			<a
				href="/topics/new"
				class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
			>
				<Plus class="mr-2 h-5 w-5" />
				New Topic
			</a>
		</div>
	</div>
{:else}
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each topics as topic (topic.id)}
			<div class="overflow-hidden rounded-lg bg-white shadow">
				<div class="p-5">
					<div class="flex items-center">
						<div class="flex-shrink-0 rounded-md bg-indigo-100 p-3">
							<Folder class="h-6 w-6 text-indigo-600" />
						</div>
						<div class="ml-5 w-0 flex-1">
							<a href={`/topics/${topic.id}`}>
								<h3 class="text-lg font-medium text-gray-900 hover:text-indigo-600">
									{topic.name}
								</h3>
							</a>
							<div class="mt-1 flex">
								<span class="mr-4 text-sm text-gray-500">
									{topic.deckCount}
									{topic.deckCount === 1 ? 'deck' : 'decks'}
								</span>
								<span class="text-sm text-gray-500">
									{topic.cardCount}
									{topic.cardCount === 1 ? 'card' : 'cards'}
								</span>
							</div>
						</div>
					</div>
				</div>
				<div class="flex justify-between bg-gray-50 px-5 py-3">
					<a href={`/topics/${topic.id}`} class="text-sm text-indigo-600 hover:text-indigo-900">
						View details
					</a>
					<div class="flex space-x-4">
						<a
							href={`/study/${topic.id}`}
							class="flex items-center text-sm text-green-600 hover:text-green-900"
						>
							<BookOpen class="mr-1 h-4 w-4" />
							Study
						</a>
						<a
							href={`/topics/${topic.id}/edit`}
							class="flex items-center text-sm text-gray-600 hover:text-gray-900"
						>
							<Pencil class="mr-1 h-4 w-4" />
							Edit
						</a>
						{#if onDelete}
							<button
								onclick={() => onDelete(topic.id)}
								class="flex items-center text-sm text-red-600 hover:text-red-900"
							>
								<Trash2 class="mr-1 h-4 w-4" />
								Delete
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
