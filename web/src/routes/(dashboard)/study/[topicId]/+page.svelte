<script lang="ts">
	import { untrack } from 'svelte';
	import { ArrowLeft } from 'lucide-svelte';
	import StudyCard from '$lib/components/study/StudyCard.svelte';
	import ProgressBar from '$lib/components/study/ProgressBar.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import type { Grade, Priority, CardState } from '$lib/sm2';
	import type { Message } from '$lib/components/chat/ChatInterface.svelte';

	interface ApiStudyCard {
		id: number;
		scheduleId: number;
		prompt: string;
		answer: string;
		promptLabel: string;
		answerLabel: string;
		note: string | null;
		priority: string;
		isReversed: boolean;
		deckId: number;
		deckName: string;
		lastSeen: string | null;
		grade: string | null;
		repCount: number;
		easiness: number;
		interval: number;
		tags: string[];
		version: number;
	}

	interface Props {
		data: {
			topic: { id: number; name: string };
			deckIds: number[];
			totalCards: number;
		};
	}

	let { data }: Props = $props();

	// State
	let currentCard = $state<ApiStudyCard | null>(null);
	let completedCards = $state(0);
	let totalCards = $state(untrack(() => data.totalCards));

	let messages = $state<Message[]>([]);
	let isGeneratingQuestion = $state(false);
	let isSendingMessage = $state(false);

	let isGraded = $state(false);
	let currentGrade = $state<Grade | null>(null);
	let originalCardState = $state<CardState | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isSessionEnded = $state(false);
	let isAnswerShown = $state(false);
	let skipGradeConfirm = $state(false);

	// Initialize study session on mount
	$effect(() => {
		initializeStudySession();
	});

	async function initializeStudySession() {
		try {
			isLoading = true;
			await fetchNextCard();
		} catch (err) {
			console.error('Error initializing study session:', err);
			error = err instanceof Error ? err.message : 'Failed to initialize study session';
		} finally {
			isLoading = false;
		}
	}

	async function fetchNextCard() {
		try {
			// Reset states for the new card
			isGraded = false;
			currentGrade = null;
			originalCardState = null;
			isAnswerShown = false;

			const params = new URLSearchParams();
			params.set('topicId', data.topic.id.toString());
			data.deckIds.forEach((id) => params.append('deckIds', id.toString()));

			const response = await fetch(`/api/study/next-card?${params.toString()}`);

			if (response.status === 404) {
				isSessionEnded = true;
				currentCard = null;
				return;
			}

			if (!response.ok) {
				throw new Error('Failed to fetch next card');
			}

			const cardData = await response.json();
			currentCard = cardData;

			// Generate question for the new card
			await generateQuestion(cardData);
		} catch (err) {
			console.error('Error fetching next card:', err);
			error = err instanceof Error ? err.message : 'Failed to fetch next card';
		}
	}

	async function generateQuestion(card: ApiStudyCard) {
		try {
			isGeneratingQuestion = true;

			const response = await fetch('/api/study/generate-question', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cardFront: card.prompt,
					cardBack: card.answer,
					cardNote: card.note,
					topicName: data.topic.name,
					topicId: data.topic.id.toString()
				})
			});

			if (!response.ok) {
				throw new Error('Failed to generate question');
			}

			const result = await response.json();
			messages = [{ role: 'assistant' as const, content: result.question }];
		} catch (err) {
			console.error('Error generating question:', err);
			messages = [
				{
					role: 'assistant' as const,
					content: `Error generating question. Please try with the following prompt: ${card.prompt}`
				}
			];
		} finally {
			isGeneratingQuestion = false;
		}
	}

	async function handleSendMessage(message: string) {
		if (!currentCard) return;

		try {
			isSendingMessage = true;

			const userMessage: Message = { role: 'user', content: message };
			messages = [...messages, userMessage];

			const response = await fetch('/api/study/chat-about-question', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userAnswer: message,
					cardFront: currentCard.prompt,
					cardBack: currentCard.answer,
					cardNote: currentCard.note,
					previousMessages: messages,
					isGraded: isGraded,
					topicName: data.topic.name,
					topicId: data.topic.id.toString()
				})
			});

			if (!response.ok) {
				throw new Error('Failed to chat about question');
			}

			const result = await response.json();
			messages = [...messages, { role: 'assistant' as const, content: result.response }];
		} catch (err) {
			console.error('Error sending message:', err);
			messages = [
				...messages,
				{
					role: 'assistant' as const,
					content: 'Sorry, I encountered an error processing your answer. Please try again.'
				}
			];
		} finally {
			isSendingMessage = false;
		}
	}

	function handleToggleAnswer() {
		isAnswerShown = !isAnswerShown;
	}

	async function handleGradeCard(grade: Grade) {
		if (!currentCard) return;

		try {
			if (!originalCardState) {
				originalCardState = {
					lastSeen: currentCard.lastSeen ? new Date(currentCard.lastSeen) : null,
					grade: currentCard.grade as Grade | null,
					repCount: currentCard.repCount,
					easiness: currentCard.easiness,
					interval: currentCard.interval
				};
			}

			currentGrade = grade;
			isGraded = true;

			const response = await fetch(`/api/schedules/${currentCard.scheduleId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grade,
					version: currentCard.version
				})
			});

			if (!response.ok) {
				if (response.status === 409) {
					const errorData = await response.json();
					if (errorData.code === 'VERSION_CONFLICT') {
						messages = [
							...messages,
							{
								role: 'assistant' as const,
								content:
									"This card was updated elsewhere. I'm refreshing it now - please grade again."
							}
						];
						isGraded = false;
						currentGrade = null;
						originalCardState = null;
						await fetchNextCard();
						return;
					}
				}
				throw new Error('Failed to grade schedule');
			}

			const updatedSchedule = await response.json();
			if (currentCard) {
				currentCard = { ...currentCard, version: updatedSchedule.version };
			}
		} catch (err) {
			console.error('Error grading card:', err);
			messages = [
				...messages,
				{
					role: 'assistant' as const,
					content: 'Sorry, I encountered an error saving your grade. Please try again.'
				}
			];
			isGraded = false;
			currentGrade = null;
		}
	}

	async function handleNextCardClick() {
		if (!isGraded) {
			skipGradeConfirm = true;
			return;
		}
		await proceedToNextCard();
	}

	async function proceedToNextCard() {
		completedCards = Math.min(completedCards + 1, totalCards);

		isGraded = false;
		currentGrade = null;
		originalCardState = null;
		messages = [];
		isAnswerShown = false;

		await fetchNextCard();
	}
</script>

<svelte:head>
	<title>Study - {data.topic.name} | Cadence Cards</title>
</svelte:head>

{#if isLoading}
	<div class="flex h-64 items-center justify-center">
		<div class="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
	</div>
{:else if error}
	<div class="space-y-6">
		<div class="mb-6">
			<a
				href="/study/setup/{data.topic.id}"
				class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Study Setup
			</a>
		</div>

		<div class="rounded-md bg-red-50 p-4">
			<div class="flex">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-sm font-medium text-red-800">Study session error</h3>
					<div class="mt-2 text-sm text-red-700">
						<p>{error}</p>
					</div>
				</div>
			</div>
		</div>

		<div class="text-center">
			<a
				href="/study"
				class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
			>
				Return to Study Setup
			</a>
		</div>
	</div>
{:else if isSessionEnded || !currentCard}
	<div class="space-y-6">
		<div class="mb-6">
			<a
				href="/study/setup/{data.topic.id}"
				class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Study Setup
			</a>
		</div>

		<div class="overflow-hidden rounded-lg bg-white py-12 text-center shadow">
			<h2 class="mb-2 text-2xl font-bold text-gray-900">Study Session Complete!</h2>
			<p class="mb-6 text-gray-600">You've completed {completedCards} cards in this session.</p>

			<div class="flex flex-col items-center space-y-4">
				<a
					href="/study"
					class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
				>
					Start a New Session
				</a>
				<a
					href="/dashboard"
					class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
				>
					Return to Dashboard
				</a>
			</div>
		</div>
	</div>
{:else}
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<a
				href="/study/setup/{data.topic.id}"
				class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
			>
				<ArrowLeft class="mr-1 h-4 w-4" />
				Back to Study Setup
			</a>
			<ProgressBar
				current={Math.min(completedCards + 1, totalCards)}
				total={totalCards}
				class="mx-auto max-w-md"
			/>
		</div>

		<StudyCard
			card={{
				id: currentCard.id,
				prompt: currentCard.prompt,
				answer: currentCard.answer,
				promptLabel: currentCard.promptLabel,
				answerLabel: currentCard.answerLabel,
				note: currentCard.note,
				priority: currentCard.priority as Priority,
				isReversed: currentCard.isReversed,
				deckId: currentCard.deckId,
				deckName: currentCard.deckName
			}}
			{messages}
			onSendMessage={handleSendMessage}
			onGrade={handleGradeCard}
			onNext={handleNextCardClick}
			{isGraded}
			{currentGrade}
			isSending={isSendingMessage}
			{isGeneratingQuestion}
			topic={data.topic}
			{isAnswerShown}
			onToggleAnswer={handleToggleAnswer}
		/>

		<ConfirmDialog
			isOpen={skipGradeConfirm}
			onClose={() => (skipGradeConfirm = false)}
			onConfirm={proceedToNextCard}
			title="Continue Without Grading?"
			message="You haven't graded this card yet. Continue anyway?"
			confirmLabel="Continue"
			confirmVariant="warning"
		/>
	</div>
{/if}
