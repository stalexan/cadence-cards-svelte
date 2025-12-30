<script lang="ts" module>
	export interface Message {
		role: 'user' | 'assistant';
		content: string;
	}
</script>

<script lang="ts">
	import { Clipboard, Check } from 'lucide-svelte';
	import Markdown from 'svelte-exmarkdown';

	interface Props {
		messages: Message[];
	}

	let { messages }: Props = $props();

	let copiedMessageIndex: number | null = $state(null);

	// Group consecutive messages from the same sender
	let groupedMessages = $derived.by(() => {
		const groups: Message[][] = [];
		let currentGroup: Message[] = [];

		messages.forEach((message, index) => {
			if (index === 0 || messages[index - 1].role !== message.role) {
				if (currentGroup.length > 0) {
					groups.push([...currentGroup]);
					currentGroup = [];
				}
			}
			currentGroup.push(message);

			if (index === messages.length - 1) {
				groups.push([...currentGroup]);
			}
		});

		return groups;
	});

	function copyToClipboard(message: Message, groupIndex: number, messageIndex: number) {
		navigator.clipboard
			.writeText(message.content)
			.then(() => {
				copiedMessageIndex = groupIndex * 1000 + messageIndex;
				setTimeout(() => {
					copiedMessageIndex = null;
				}, 2000);
			})
			.catch((err) => {
				console.error('Failed to copy message: ', err);
			});
	}
</script>

{#if messages.length === 0}
	<div class="flex h-full items-center justify-center text-gray-500">No messages yet</div>
{:else}
	<div class="space-y-6">
		{#each groupedMessages as group, groupIndex (groupIndex)}
			{@const isUser = group[0].role === 'user'}
			<div class="flex {isUser ? 'justify-end' : 'justify-start'}">
				<div class="max-w-[85%] space-y-2">
					{#each group as message, messageIndex (messageIndex)}
						{@const isCurrentMessageCopied =
							copiedMessageIndex === groupIndex * 1000 + messageIndex}
						<div
							class="relative rounded-lg {isUser
								? 'rounded-tr-none bg-indigo-600 px-4 py-3 text-white'
								: 'rounded-tl-none border border-gray-200 bg-white px-4 py-3 pr-10 text-gray-800 shadow-sm'}"
						>
							<div class="text-sm">
								{#if isUser}
									<div class="whitespace-pre-wrap">{message.content}</div>
								{:else}
									<div class="markdown-content">
										<Markdown md={message.content} />
									</div>
								{/if}
							</div>

							{#if !isUser}
								<button
									onclick={() => copyToClipboard(message, groupIndex, messageIndex)}
									class="absolute top-3 right-3 rounded-md p-1 transition-colors {isCurrentMessageCopied
										? 'bg-green-100 text-green-600'
										: 'text-gray-500 hover:bg-gray-100'}"
									title="Copy to clipboard"
								>
									{#if isCurrentMessageCopied}
										<Check class="h-4 w-4" />
									{:else}
										<Clipboard class="h-4 w-4" />
									{/if}
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
