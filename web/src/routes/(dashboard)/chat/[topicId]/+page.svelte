<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import ChatInterface from '$lib/components/chat/ChatInterface.svelte';
	import type { Message } from '$lib/components/chat/MessageList.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Welcome message - uses $derived to access data.topic.name reactively
	const welcomeMessage = $derived<Message>({
		role: 'assistant',
		content: `Welcome! I'm here to help you learn about **${data.topic.name}**. Ask me any questions you have about this topic.`
	});

	// Chat messages (user questions and Claude responses, excluding welcome)
	let chatMessages = $state<Message[]>([]);

	// All messages including welcome for display
	const messages = $derived<Message[]>([welcomeMessage, ...chatMessages]);

	let isSending = $state(false);
	let isFirstMessage = $state(true);
	let error = $state<string | null>(null);

	async function handleSendMessage(message: string) {
		if (isSending) return;

		isSending = true;

		// Add user message to the list
		chatMessages = [...chatMessages, { role: 'user', content: message }];

		// Create previousMessages array
		// If this is the first message, we don't send any previous messages to API
		// The API will handle adding the GENERAL_INSTRUCTIONS and "Understood." messages
		let previousMessages: Message[] = [];
		if (!isFirstMessage) {
			// Send chat messages (excludes welcome message) to API
			previousMessages = chatMessages.slice();
		}

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message,
					topicId: data.topic.id.toString(),
					topicName: data.topic.name,
					previousMessages,
					isFirstMessage
				})
			});

			if (!response.ok) {
				throw new Error('Failed to send message');
			}

			const result = await response.json();
			chatMessages = [...chatMessages, { role: 'assistant', content: result.response }];

			// Mark that we've sent the first message
			if (isFirstMessage) {
				isFirstMessage = false;
			}
		} catch (err) {
			console.error('Error sending message:', err);
			// Add error message to chat
			chatMessages = [
				...chatMessages,
				{
					role: 'assistant',
					content: 'Sorry, I encountered an error. Please try again or refresh the page.'
				}
			];
		} finally {
			isSending = false;
		}
	}
</script>

<svelte:head>
	<title>Chat - {data.topic.name} - Cadence Cards</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="mb-4">
		<a href="/chat" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Topic Selection
		</a>
		<h1 class="mt-2 text-xl font-bold text-gray-900">Chat: {data.topic.name}</h1>
	</div>

	{#if error}
		<div class="mb-4 rounded-md bg-red-50 p-4">
			<p class="text-sm text-red-700">{error}</p>
		</div>
	{/if}

	<div class="min-h-0 flex-1">
		<ChatInterface
			{messages}
			onSendMessage={handleSendMessage}
			isLoading={isSending}
			placeholder="Ask Claude about {data.topic.name}..."
			class="h-full"
		/>
	</div>
</div>
