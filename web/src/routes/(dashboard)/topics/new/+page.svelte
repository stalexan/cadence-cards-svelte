<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import TopicForm from '$lib/components/topics/TopicForm.svelte';
	import type { ActionData } from './$types';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();
</script>

<svelte:head>
	<title>Create Topic - Cadence Cards</title>
</svelte:head>

<div>
	<div class="mb-6">
		<a href="/topics" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Topics
		</a>
	</div>

	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<h1 class="mb-6 text-xl font-semibold text-gray-900">Create New Topic</h1>

			<TopicForm cancelHref="/topics" error={form?.error} />
		</div>
	</div>
</div>
