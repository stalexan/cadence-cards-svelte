<script lang="ts">
	import MessageList from './MessageList.svelte';
	import { Send } from 'lucide-svelte';

	export interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	interface Props {
		messages: Message[];
		onSendMessage: (message: string) => Promise<void>;
		isLoading?: boolean;
		placeholder?: string;
		class?: string;
		disableInput?: boolean;
	}

	let {
		messages,
		onSendMessage,
		isLoading = false,
		placeholder = 'Type your message...',
		class: className = '',
		disableInput = false
	}: Props = $props();

	let newMessage = $state('');
	let textareaRef: HTMLTextAreaElement | null = $state(null);
	let messagesEndRef: HTMLDivElement | null = $state(null);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!newMessage.trim() || isLoading || disableInput) return;

		const messageToSend = newMessage;
		newMessage = '';

		// Reset textarea height
		if (textareaRef) {
			textareaRef.style.height = 'auto';
		}

		await onSendMessage(messageToSend);
	}

	function handleTextareaChange(e: Event) {
		const textarea = e.target as HTMLTextAreaElement;
		newMessage = textarea.value;

		// Reset height to calculate the right scrollHeight
		textarea.style.height = 'auto';

		// Set new height based on content (but max 150px)
		textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}

	// Scroll to bottom when messages change
	$effect(() => {
		if (messagesEndRef && messages.length > 0) {
			messagesEndRef.scrollIntoView({ behavior: 'smooth' });
		}
	});
</script>

<div class="flex h-full flex-col {className}">
	<!-- Claude-style chat layout with narrower container -->
	<div
		class="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow"
	>
		<!-- Messages area with Claude-style background -->
		<div class="flex-1 overflow-y-auto bg-gray-50 p-4">
			<div class="mx-auto max-w-2xl">
				<MessageList {messages} />
				<div bind:this={messagesEndRef}></div>

				<!-- Loading indicator -->
				{#if isLoading}
					<div class="mt-4 flex justify-start">
						<div class="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
							<div class="flex space-x-2">
								<div class="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
								<div
									class="h-2 w-2 animate-bounce rounded-full bg-gray-400"
									style="animation-delay: 0.2s"
								></div>
								<div
									class="h-2 w-2 animate-bounce rounded-full bg-gray-400"
									style="animation-delay: 0.4s"
								></div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Message input with Claude-style layout -->
		<div class="border-t border-gray-200 bg-white p-4">
			<div class="mx-auto max-w-2xl">
				<form onsubmit={handleSubmit} class="flex items-end">
					<div class="min-w-0 flex-1">
						<textarea
							bind:this={textareaRef}
							value={newMessage}
							oninput={handleTextareaChange}
							onkeydown={handleKeyDown}
							{placeholder}
							disabled={isLoading || disableInput}
							class="block max-h-[150px] min-h-[42px] w-full resize-none overflow-hidden rounded-lg border-gray-300 px-4 py-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 sm:text-sm"
							rows="1"
						></textarea>
					</div>
					<button
						type="submit"
						disabled={!newMessage.trim() || isLoading || disableInput}
						class="ml-3 inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-indigo-400"
					>
						<Send class="h-5 w-5" />
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
