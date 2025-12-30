<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, MessageCircle } from 'lucide-svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let deleteConfirm = $state(false);

	function formatDate(date: string | Date): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.topic.name} - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href="/topics" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Topics
		</a>
	</div>

	<div class="mb-6 overflow-hidden rounded-lg bg-white shadow">
		<div class="flex items-center justify-between px-4 py-5 sm:px-6">
			<div>
				<h1 class="text-xl font-bold text-gray-900">{data.topic.name}</h1>
				<p class="mt-1 text-sm text-gray-500">Created on {formatDate(data.topic.createdAt)}</p>
			</div>
			<div class="flex space-x-2">
				<a
					href={`/chat/${data.topic.id}`}
					class="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
				>
					<MessageCircle class="mr-1 h-4 w-4" />
					Chat
				</a>
				<a
					href={`/study/setup/${data.topic.id}`}
					class="inline-flex items-center rounded-md border border-transparent bg-green-100 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-200"
				>
					<BookOpen class="mr-1 h-4 w-4" />
					Study
				</a>
				<a
					href={`/topics/${data.topic.id}/edit`}
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

		<!-- Topic Configuration Details -->
		<div class="border-t border-gray-200 px-4 py-5 sm:p-6">
			<h2 class="mb-4 text-lg font-medium text-gray-900">Topic Configuration</h2>
			<dl class="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
				<div>
					<dt class="text-sm font-medium text-gray-500">Topic Description</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{data.topic.topicDescription || 'Not specified'}
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Expertise</dt>
					<dd class="mt-1 text-sm text-gray-900">{data.topic.expertise || 'Not specified'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Focus</dt>
					<dd class="mt-1 text-sm text-gray-900">{data.topic.focus || 'Not specified'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Context Type</dt>
					<dd class="mt-1 text-sm text-gray-900">{data.topic.contextType || 'Not specified'}</dd>
				</div>
			</dl>

			{#if data.topic.example}
				<div class="mt-6">
					<h3 class="text-sm font-medium text-gray-500">Examples</h3>
					<div class="mt-1 rounded border border-gray-200 bg-gray-50 p-4">
						<pre class="text-sm whitespace-pre-wrap text-gray-900">{data.topic.example}</pre>
					</div>
				</div>
			{/if}

			{#if data.topic.question}
				<div class="mt-6">
					<h3 class="text-sm font-medium text-gray-500">Question Prompt</h3>
					<div class="mt-1 rounded border border-gray-200 bg-gray-50 p-4">
						<pre class="text-sm whitespace-pre-wrap text-gray-900">{data.topic.question}</pre>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-lg font-medium text-gray-900">Decks</h2>
				<a
					href={`/decks/new?topicId=${data.topic.id}`}
					class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
				>
					<Plus class="mr-2 h-5 w-5" />
					New Deck
				</a>
			</div>

			{#if !data.decks || data.decks.length === 0}
				<div class="py-12 text-center">
					<BookOpen class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900">No decks yet</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by creating a new deck.</p>
					<div class="mt-6">
						<a
							href={`/decks/new?topicId=${data.topic.id}`}
							class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
						>
							<Plus class="mr-2 h-5 w-5" />
							New Deck
						</a>
					</div>
				</div>
			{:else}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.decks as deck (deck.id)}
						<div class="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
							<div class="p-5">
								<div class="flex items-center">
									<div class="flex-shrink-0 rounded-md bg-blue-100 p-3">
										<BookOpen class="h-6 w-6 text-blue-600" />
									</div>
									<div class="ml-5 w-0 flex-1">
										<a href={`/decks/${deck.id}`}>
											<h3 class="text-lg font-medium text-gray-900 hover:text-indigo-600">
												{deck.name}
											</h3>
										</a>
										<p class="mt-1 text-sm text-gray-500">
											{deck.cardCount}
											{deck.cardCount === 1 ? 'card' : 'cards'}
										</p>
									</div>
								</div>
							</div>
							<div class="flex justify-end space-x-3 bg-gray-100 px-5 py-3">
								<a href={`/decks/${deck.id}`} class="text-sm text-indigo-600 hover:text-indigo-900">
									View
								</a>
								<a
									href={`/decks/${deck.id}/edit`}
									class="text-sm text-gray-600 hover:text-gray-900"
								>
									Edit
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<form method="POST" action="?/delete" class="hidden" id="deleteForm" use:enhance></form>

	<ConfirmDialog
		isOpen={deleteConfirm}
		title="Delete Topic?"
		message="Are you sure you want to delete this topic? This will also delete all associated decks and cards."
		confirmLabel="Delete"
		confirmVariant="danger"
		onClose={() => (deleteConfirm = false)}
		onConfirm={() => {
			const form = document.getElementById('deleteForm') as HTMLFormElement;
			form?.submit();
		}}
	/>
</div>
