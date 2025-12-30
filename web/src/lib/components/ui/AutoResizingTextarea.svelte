<script lang="ts">
	interface Props {
		id?: string;
		name?: string;
		value: string;
		onchange?: (e: Event) => void;
		placeholder?: string;
		minHeight?: number;
		class?: string;
		disabled?: boolean;
	}

	let {
		id,
		name,
		value = $bindable(),
		onchange,
		placeholder = '',
		minHeight = 100,
		class: className = '',
		disabled = false
	}: Props = $props();

	let textareaRef: HTMLTextAreaElement | null = $state(null);

	$effect(() => {
		if (textareaRef) {
			// Reset height to auto to get the correct scrollHeight
			textareaRef.style.height = 'auto';

			// Set the height to the scrollHeight or minHeight, whichever is greater
			const newHeight = Math.max(textareaRef.scrollHeight, minHeight);
			textareaRef.style.height = `${newHeight}px`;
		}
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onchange?.(e);
	}
</script>

<textarea
	bind:this={textareaRef}
	{id}
	{name}
	{value}
	oninput={handleInput}
	{placeholder}
	class={className}
	style="min-height: {minHeight}px; resize: vertical;"
	{disabled}
></textarea>
