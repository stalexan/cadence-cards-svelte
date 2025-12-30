<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		title: string;
		children: Snippet;
		footer?: Snippet;
		maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	}

	let { isOpen, onClose, title, children, footer, maxWidth = 'md' }: Props = $props();

	const maxWidthClasses: Record<string, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl'
	};

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleKeydown);
			document.body.style.overflow = 'hidden';

			return () => {
				document.removeEventListener('keydown', handleKeydown);
				document.body.style.overflow = 'auto';
			};
		}
	});
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby={title}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0"
			onclick={handleBackdropClick}
			onkeydown={handleKeydown}
			role="presentation"
		>
			<div
				class="pointer-events-none fixed inset-0 bg-gray-500/30 transition-opacity"
				aria-hidden="true"
			></div>

			<!-- This element is to trick the browser into centering the modal contents. -->
			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"
				>&#8203;</span
			>

			<div
				class="relative z-10 inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle {maxWidthClasses[
					maxWidth
				]} w-full"
			>
				<div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
								{title}
							</h3>
							<div class="mt-4">{@render children()}</div>
						</div>
					</div>
				</div>

				{#if footer}
					<div class="gap-3 bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
						{@render footer()}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
