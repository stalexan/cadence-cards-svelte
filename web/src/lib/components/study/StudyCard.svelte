<script lang="ts">
	import { ArrowRight, Eye, FileText } from 'lucide-svelte';
	import GradingButtons from './GradingButtons.svelte';
	import ChatInterface from '$lib/components/chat/ChatInterface.svelte';
	import type { Grade, Priority } from '$lib/sm2';
	import type { Message } from '$lib/components/chat/ChatInterface.svelte';

	interface StudyCardData {
		id: number;
		prompt: string;
		answer: string;
		promptLabel: string;
		answerLabel: string;
		note: string | null;
		priority: Priority;
		isReversed: boolean;
		deckId: number;
		deckName: string;
	}

	interface Topic {
		id: number;
		name: string;
	}

	interface Props {
		card: StudyCardData;
		messages: Message[];
		onSendMessage: (message: string) => Promise<void>;
		onGrade: (grade: Grade) => void;
		onNext: () => void;
		isGraded?: boolean;
		currentGrade: Grade | null;
		isSending?: boolean;
		isGeneratingQuestion?: boolean;
		topic: Topic | null;
		isAnswerShown?: boolean;
		onToggleAnswer: () => void;
	}

	let {
		card,
		messages,
		onSendMessage,
		onGrade,
		onNext,
		currentGrade,
		isSending = false,
		isGeneratingQuestion = false,
		topic,
		isAnswerShown = false,
		onToggleAnswer
	}: Props = $props();
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
	<!-- Left column - Card Info -->
	<div class="md:col-span-1">
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:p-6">
				<h2 class="mb-4 text-lg font-medium text-gray-900">Card Information</h2>

				<div class="space-y-4">
					<div>
						<span class="text-xs font-medium text-gray-500">Topic</span>
						<p class="mt-1 text-sm text-gray-900">{topic?.name || 'Unknown'}</p>
					</div>

					<div>
						<span class="text-xs font-medium text-gray-500">Deck</span>
						<p class="mt-1 text-sm text-gray-900">{card.deckName}</p>
					</div>

					<div class="flex items-center space-x-2">
						<span class="text-xs font-medium text-gray-500">Priority</span>
						<span
							class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {card.priority ===
							'A'
								? 'bg-red-100 text-red-800'
								: card.priority === 'B'
									? 'bg-yellow-100 text-yellow-800'
									: 'bg-green-100 text-green-800'}"
						>
							{card.priority}
						</span>
					</div>

					<!-- View Card Link -->
					<div class="mt-4">
						<a
							href="/cards/{card.id}"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
						>
							<FileText class="mr-1 h-4 w-4" />
							View Card Details
						</a>
					</div>
				</div>

				<!-- Show Answer Button -->
				<div class="mt-6 border-t border-gray-200 pt-4">
					<button
						type="button"
						onclick={onToggleAnswer}
						class="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
					>
						<Eye class="mr-2 h-5 w-5" />
						{isAnswerShown ? 'Hide Answer' : 'Show Answer'}
					</button>

					<!-- Card Answer Section - shows direction-aware prompt/answer -->
					{#if isAnswerShown}
						<div class="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
							<!-- Direction indicator for bidirectional decks -->
							{#if card.isReversed}
								<div class="mb-3 border-b border-gray-200 pb-2">
									<span class="rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600">
										Reverse Direction
									</span>
								</div>
							{/if}

							<h3 class="mb-2 text-sm font-medium text-gray-700">
								{card.promptLabel}:
							</h3>
							<div class="text-sm whitespace-pre-wrap text-gray-900">
								{card.prompt}
							</div>

							<div class="mt-3 border-t border-gray-200 pt-3">
								<h3 class="mb-2 text-sm font-medium text-gray-700">
									{card.answerLabel}:
								</h3>
								<div class="text-sm whitespace-pre-wrap text-gray-900">
									{card.answer}
								</div>
							</div>

							{#if card.note}
								<div class="mt-3 border-t border-gray-200 pt-3">
									<h3 class="mb-2 text-sm font-medium text-gray-700">Note:</h3>
									<div class="text-sm whitespace-pre-wrap text-gray-600">
										{card.note}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Grading section -->
				<div class="mt-6 border-t border-gray-200 pt-4">
					<GradingButtons {onGrade} disabled={false} {currentGrade} />

					<div class="mt-4">
						<button
							type="button"
							onclick={onNext}
							class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
						>
							Next Card
							<ArrowRight class="ml-2 h-5 w-5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Right column - Chat -->
	<div class="md:col-span-2">
		<ChatInterface
			{messages}
			{onSendMessage}
			isLoading={isSending || isGeneratingQuestion}
			placeholder="Type your answer..."
			class="h-[600px]"
		/>
	</div>
</div>
