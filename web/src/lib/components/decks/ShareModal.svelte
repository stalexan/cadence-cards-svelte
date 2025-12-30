<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { Clipboard, Download, CheckCircle } from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		deckName: string;
		deckId: number;
	}

	let { isOpen, onClose, deckName, deckId }: Props = $props();

	let copied = $state(false);
	let copyError = $state<string | null>(null);
	let includeSm2Params = $state(false);
	let yamlContent = $state('');
	let isRegenerating = $state(false);
	let hasInitialized = $state(false);

	// Reset state when modal closes
	$effect(() => {
		if (!isOpen) {
			copied = false;
			copyError = null;
			includeSm2Params = false;
			yamlContent = '';
			hasInitialized = false;
		}
	});

	// Regenerate YAML when modal opens or checkbox changes
	$effect(() => {
		if (isOpen) {
			regenerateYaml();
		}
	});

	async function regenerateYaml() {
		isRegenerating = true;
		try {
			const response = await fetch(
				`/api/decks/${deckId}/export?includeSm2Params=${includeSm2Params}`
			);
			if (!response.ok) {
				throw new Error('Failed to export deck');
			}
			yamlContent = await response.text();
			hasInitialized = true;
		} catch (error) {
			console.error('Failed to regenerate YAML:', error);
			if (!hasInitialized) {
				yamlContent = '';
			}
		} finally {
			isRegenerating = false;
		}
	}

	async function handleIncludeSm2ParamsChange(checked: boolean) {
		includeSm2Params = checked;
		isRegenerating = true;
		try {
			const response = await fetch(`/api/decks/${deckId}/export?includeSm2Params=${checked}`);
			if (!response.ok) {
				throw new Error('Failed to regenerate export');
			}
			yamlContent = await response.text();
		} catch (error) {
			console.error('Failed to regenerate YAML:', error);
			alert('Failed to regenerate YAML. Please try again.');
			includeSm2Params = !checked; // Revert checkbox
		} finally {
			isRegenerating = false;
		}
	}

	async function handleCopyToClipboard() {
		try {
			await navigator.clipboard.writeText(yamlContent);
			copied = true;
			copyError = null;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
			copyError = 'Failed to copy. Please select and copy manually.';
			copied = false;
		}
	}

	function handleDownload() {
		try {
			const blob = new Blob([yamlContent], { type: 'text/yaml' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${deckName.toLowerCase().replace(/\s+/g, '-')}.yaml`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to download file:', error);
			alert('Failed to download file. Please try again.');
		}
	}

	function handleTextareaClick(e: MouseEvent) {
		const target = e.target as HTMLTextAreaElement;
		target.select();
	}
</script>

<Dialog {isOpen} {onClose} title={`Share "${deckName}"`} maxWidth="2xl">
	<div class="space-y-4">
		<!-- Instructions -->
		<div class="rounded-md border border-blue-200 bg-blue-50 p-4">
			<p class="mb-2 text-sm text-blue-800">
				<strong>How to share:</strong>
			</p>
			<ul class="list-inside list-disc space-y-1 text-sm text-blue-700">
				<li>Copy the YAML content below and share it with others</li>
				<li>Recipients can import it via the Import page</li>
				<li class="font-medium text-blue-600">
					Note: Your username will be included in the shared deck
				</li>
			</ul>
		</div>

		<!-- SM-2 Parameters Checkbox -->
		<div class="flex items-center space-x-2 rounded-md border border-gray-200 bg-gray-50 p-3">
			<input
				type="checkbox"
				id="include-sm2"
				checked={includeSm2Params}
				onchange={(e) => handleIncludeSm2ParamsChange((e.target as HTMLInputElement).checked)}
				disabled={isRegenerating}
				class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
			/>
			<label for="include-sm2" class="cursor-pointer text-sm text-gray-700">
				Include SM-2 parameters (study progress, intervals, etc.)
				{#if isRegenerating}
					<span class="ml-2 text-gray-500">(Regenerating...)</span>
				{/if}
			</label>
		</div>

		<!-- Action buttons -->
		<div class="flex space-x-3">
			<button
				type="button"
				onclick={handleCopyToClipboard}
				class="inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none {copied
					? 'bg-green-600 hover:bg-green-700'
					: 'bg-indigo-600 hover:bg-indigo-700'}"
			>
				{#if copied}
					<CheckCircle class="mr-2 h-5 w-5" />
					Copied!
				{:else}
					<Clipboard class="mr-2 h-5 w-5" />
					Copy to Clipboard
				{/if}
			</button>
			<button
				type="button"
				onclick={handleDownload}
				class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
			>
				<Download class="mr-2 h-5 w-5" />
				Download as File
			</button>
		</div>

		<!-- Error message -->
		{#if copyError}
			<div class="rounded-md border border-red-200 bg-red-50 p-3">
				<p class="text-sm text-red-800">{copyError}</p>
				<p class="mt-1 text-xs text-red-600">
					You can manually select the text below and copy it (Ctrl+C or Cmd+C)
				</p>
			</div>
		{/if}

		<!-- YAML content -->
		<div>
			<label for="yaml-content" class="mb-2 block text-sm font-medium text-gray-700">
				YAML Content:
			</label>
			<textarea
				id="yaml-content"
				readonly
				value={yamlContent}
				onclick={handleTextareaClick}
				class="h-64 w-full rounded-md border border-gray-300 bg-gray-50 p-3 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
			></textarea>
		</div>
	</div>

	{#snippet footer()}
		<button
			type="button"
			onclick={onClose}
			class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
		>
			Close
		</button>
	{/snippet}
</Dialog>
