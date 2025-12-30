<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Upload, CheckCircle, AlertCircle } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Import Cards - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href="/dashboard" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Dashboard
		</a>
	</div>

	<h1 class="mb-6 text-2xl font-bold text-gray-900">Import Cards</h1>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			{#if form?.success}
				<div class="mb-6 rounded-md bg-green-50 p-4">
					<div class="flex">
						<CheckCircle class="h-5 w-5 text-green-400" />
						<div class="ml-3">
							<h3 class="text-sm font-medium text-green-800">Import Complete</h3>
							<div class="mt-2 text-sm text-green-700">
								<p>Successfully imported {form.imported} cards.</p>
								{#if form.skipped && form.skipped > 0}
									<p>Skipped {form.skipped} cards (duplicates or invalid).</p>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/if}

			{#if form?.error}
				<div class="mb-6 rounded-md bg-red-50 p-4">
					<div class="flex">
						<AlertCircle class="h-5 w-5 text-red-400" />
						<div class="ml-3">
							<h3 class="text-sm font-medium text-red-800">Import Error</h3>
							<div class="mt-2 text-sm text-red-700">
								<p>{form.error}</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						await update();
						isSubmitting = false;
					};
				}}
			>
				<div class="mb-6">
					<label for="deckId" class="mb-1 block text-sm font-medium text-gray-700">
						Target Deck
					</label>
					{#if data.decks.length === 0}
						<div class="text-sm text-gray-500">
							No decks available. Please
							<a href="/decks/new" class="text-indigo-600 hover:text-indigo-900">create a deck</a>
							first.
						</div>
					{:else}
						<select
							id="deckId"
							name="deckId"
							required
							class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						>
							<option value="">Select a deck</option>
							{#each data.decks as deck (deck.id)}
								<option value={deck.id}>
									{deck.name}
									{deck.topicName ? `(${deck.topicName})` : ''}
								</option>
							{/each}
						</select>
					{/if}
				</div>

				<div class="mb-6">
					<label for="yamlContent" class="mb-1 block text-sm font-medium text-gray-700">
						YAML Content
					</label>
					<textarea
						id="yamlContent"
						name="yamlContent"
						rows={15}
						required
						placeholder={`cards:
  - front: What is the capital of France?
    back: Paris
    priority: A
    tags:
      - geography
      - europe
  - front: What is 2 + 2?
    back: 4
    priority: B`}
						class="block w-full rounded-md border-gray-300 font-mono shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					></textarea>
					<p class="mt-2 text-xs text-gray-500">
						Paste your YAML-formatted cards above. Each card should have 'front' and 'back' fields.
						Optional fields: 'priority' (A, B, or C), 'note', 'tags' (array).
					</p>
				</div>

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={isSubmitting || data.decks.length === 0}
						class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
					>
						<Upload class="mr-2 h-4 w-4" />
						{isSubmitting ? 'Importing...' : 'Import Cards'}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
