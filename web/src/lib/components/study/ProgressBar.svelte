<script lang="ts">
	interface Props {
		current: number;
		total: number;
		class?: string;
	}

	let { current, total, class: className = '' }: Props = $props();

	let percentage = $derived(total > 0 ? Math.round((current / total) * 100) : 0);

	let color = $derived.by(() => {
		if (percentage < 33) {
			return 'bg-indigo-500';
		} else if (percentage < 66) {
			return 'bg-indigo-600';
		} else {
			return 'bg-indigo-700';
		}
	});
</script>

<div class="w-full {className}">
	<div class="mb-1 flex justify-between">
		<span class="text-sm font-medium text-gray-700">Progress</span>
		<span class="text-sm font-medium text-gray-700">{current} of {total} cards</span>
	</div>
	<div class="h-2.5 w-full rounded-full bg-gray-200">
		<div
			class="h-2.5 rounded-full {color} transition-all duration-300 ease-in-out"
			style="width: {percentage}%"
		></div>
	</div>
</div>
