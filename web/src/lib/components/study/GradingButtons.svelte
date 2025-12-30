<script lang="ts">
	import { Grade } from '$lib/sm2';
	import { CheckCircle, XCircle, HelpCircle } from 'lucide-svelte';

	interface Props {
		onGrade: (grade: Grade) => void;
		disabled?: boolean;
		currentGrade?: Grade | null;
		class?: string;
	}

	let { onGrade, disabled = false, currentGrade = null, class: className = '' }: Props = $props();
</script>

<div class="space-y-2 {className}">
	<h3 class="mb-2 text-sm font-medium text-gray-900">Rate Your Recall</h3>

	<div class="flex flex-col space-y-2">
		<button
			type="button"
			{disabled}
			onclick={() => onGrade(Grade.CORRECT_PERFECT_RECALL)}
			class="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium {currentGrade ===
			Grade.CORRECT_PERFECT_RECALL
				? 'border-transparent bg-green-500 text-white'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} {disabled &&
			currentGrade !== Grade.CORRECT_PERFECT_RECALL
				? 'cursor-not-allowed opacity-50'
				: ''}"
		>
			<CheckCircle class="mr-2 h-5 w-5" />
			Perfect Recall
			<span class="ml-1 text-xs opacity-75">(I knew it immediately)</span>
		</button>

		<button
			type="button"
			{disabled}
			onclick={() => onGrade(Grade.CORRECT_WITH_HESITATION)}
			class="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium {currentGrade ===
			Grade.CORRECT_WITH_HESITATION
				? 'border-transparent bg-yellow-500 text-white'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} {disabled &&
			currentGrade !== Grade.CORRECT_WITH_HESITATION
				? 'cursor-not-allowed opacity-50'
				: ''}"
		>
			<HelpCircle class="mr-2 h-5 w-5" />
			Correct with Hesitation
			<span class="ml-1 text-xs opacity-75">(I had to think about it)</span>
		</button>

		<button
			type="button"
			{disabled}
			onclick={() => onGrade(Grade.INCORRECT)}
			class="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium {currentGrade ===
			Grade.INCORRECT
				? 'border-transparent bg-red-500 text-white'
				: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} {disabled &&
			currentGrade !== Grade.INCORRECT
				? 'cursor-not-allowed opacity-50'
				: ''}"
		>
			<XCircle class="mr-2 h-5 w-5" />
			Incorrect
			<span class="ml-1 text-xs opacity-75">(I didn't remember correctly)</span>
		</button>
	</div>

	{#if !disabled && currentGrade !== null}
		<div class="mt-4 text-xs text-gray-500">
			<p>You can change your grade for this card if needed.</p>
		</div>
	{/if}
</div>
