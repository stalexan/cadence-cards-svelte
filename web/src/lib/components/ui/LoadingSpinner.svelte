<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<div class="flex h-64 items-center justify-center {className}">
	<div class="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
</div>
