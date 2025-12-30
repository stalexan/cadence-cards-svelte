<script lang="ts">
	import Dialog from './Dialog.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: () => void;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		confirmVariant?: 'danger' | 'primary' | 'warning';
	}

	let {
		isOpen,
		onClose,
		onConfirm,
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		confirmVariant = 'primary'
	}: Props = $props();

	const confirmButtonClasses: Record<string, string> = {
		danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
		primary: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
		warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
	};

	function handleConfirm() {
		onConfirm();
		onClose();
	}
</script>

<Dialog {isOpen} {onClose} {title}>
	<p class="text-sm text-gray-500">{message}</p>

	{#snippet footer()}
		<button
			type="button"
			onclick={handleConfirm}
			class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none {confirmButtonClasses[
				confirmVariant
			]}"
		>
			{confirmLabel}
		</button>
		<button
			type="button"
			onclick={onClose}
			class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
		>
			{cancelLabel}
		</button>
	{/snippet}
</Dialog>
