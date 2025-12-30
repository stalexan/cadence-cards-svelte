<script lang="ts">
	import type { Snippet, Component } from 'svelte';
	import type { Icon as LucideIcon } from 'lucide-svelte';

	interface Props {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: Component<{ class?: string }> | typeof LucideIcon | any;
		title: string;
		description: string;
		action?: Snippet;
	}

	let { icon: Icon, title, description, action }: Props = $props();
</script>

<div class="rounded-lg bg-white py-12 text-center shadow">
	<Icon class="mx-auto h-12 w-12 text-gray-400" />
	<h3 class="mt-2 text-sm font-medium text-gray-900">{title}</h3>
	<p class="mt-1 text-sm text-gray-500">{description}</p>
	{#if action}
		<div class="mt-6">{@render action()}</div>
	{/if}
</div>
