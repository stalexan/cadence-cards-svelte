<script lang="ts">
	import { ArrowRight, Folder, BookOpen, FileText, BarChart3 } from 'lucide-svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Apply defaults for any missing statistics values
	const stats = $derived({
		totalTopics: data.stats?.totalTopics || 0,
		totalDecks: data.stats?.totalDecks || 0,
		totalCards: data.stats?.totalCards || 0,
		cardsCorrect: data.stats?.cardsCorrect || 0,
		cardsIncorrect: data.stats?.cardsIncorrect || 0,
		cardsDue: {
			priorityA: data.stats?.cardsDue?.priorityA || 0,
			priorityB: data.stats?.cardsDue?.priorityB || 0,
			priorityC: data.stats?.cardsDue?.priorityC || 0
		},
		recentActivity: data.stats?.recentActivity || []
	});

	const correctPercentage = $derived(
		stats.totalCards > 0 ? Math.round((stats.cardsCorrect / stats.totalCards) * 100) : 0
	);

	// Get user name from parent layout data
	const userName = $derived(data.user?.name || 'User');
</script>

<svelte:head>
	<title>Dashboard - Cadence Cards</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Welcome back, {userName}</h1>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Topics -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 rounded-md bg-indigo-100 p-3">
						<Folder class="h-6 w-6 text-indigo-600" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500">Total Topics</dt>
							<dd class="text-xl font-semibold text-gray-900">{stats.totalTopics}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<a href="/topics" class="flex items-center text-sm text-indigo-600 hover:text-indigo-900">
					View all topics
					<ArrowRight class="ml-1 h-4 w-4" />
				</a>
			</div>
		</div>

		<!-- Total Decks -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 rounded-md bg-blue-100 p-3">
						<BookOpen class="h-6 w-6 text-blue-600" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500">Total Decks</dt>
							<dd class="text-xl font-semibold text-gray-900">{stats.totalDecks}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<a href="/decks" class="flex items-center text-sm text-indigo-600 hover:text-indigo-900">
					View all decks
					<ArrowRight class="ml-1 h-4 w-4" />
				</a>
			</div>
		</div>

		<!-- Total Cards -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 rounded-md bg-green-100 p-3">
						<FileText class="h-6 w-6 text-green-600" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500">Total Cards</dt>
							<dd class="text-xl font-semibold text-gray-900">{stats.totalCards}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<a href="/cards" class="flex items-center text-sm text-indigo-600 hover:text-indigo-900">
					View all cards
					<ArrowRight class="ml-1 h-4 w-4" />
				</a>
			</div>
		</div>

		<!-- Correct Rate -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0 rounded-md bg-purple-100 p-3">
						<BarChart3 class="h-6 w-6 text-purple-600" />
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="truncate text-sm font-medium text-gray-500">Correct Rate</dt>
							<dd class="text-xl font-semibold text-gray-900">{correctPercentage}%</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<a href="/study" class="flex items-center text-sm text-indigo-600 hover:text-indigo-900">
					Study now
					<ArrowRight class="ml-1 h-4 w-4" />
				</a>
			</div>
		</div>
	</div>

	<!-- Due Cards -->
	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<h3 class="text-lg leading-6 font-medium text-gray-900">Cards Due Today</h3>
			<div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
				<div class="overflow-hidden rounded-lg bg-indigo-50 px-4 py-5 sm:p-6">
					<dt class="truncate text-sm font-medium text-indigo-800">Priority A</dt>
					<dd class="mt-1 text-3xl font-semibold text-indigo-600">
						{stats.cardsDue.priorityA}
					</dd>
				</div>

				<div class="overflow-hidden rounded-lg bg-blue-50 px-4 py-5 sm:p-6">
					<dt class="truncate text-sm font-medium text-blue-800">Priority B</dt>
					<dd class="mt-1 text-3xl font-semibold text-blue-600">
						{stats.cardsDue.priorityB}
					</dd>
				</div>

				<div class="overflow-hidden rounded-lg bg-green-50 px-4 py-5 sm:p-6">
					<dt class="truncate text-sm font-medium text-green-800">Priority C</dt>
					<dd class="mt-1 text-3xl font-semibold text-green-600">
						{stats.cardsDue.priorityC}
					</dd>
				</div>
			</div>
		</div>
		<div class="bg-gray-50 px-4 py-4 sm:px-6">
			<div class="text-sm">
				<a href="/study" class="font-medium text-indigo-600 hover:text-indigo-500">
					Start study session
					<span aria-hidden="true"> →</span>
				</a>
			</div>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="overflow-hidden rounded-lg bg-white shadow">
		<div class="px-4 py-5 sm:p-6">
			<h3 class="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
			<div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				<a
					href="/topics/new"
					class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
				>
					Create Topic
				</a>
				<a
					href="/decks/new"
					class="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
				>
					Create Deck
				</a>
				<a
					href="/cards/new"
					class="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
				>
					Add Card
				</a>
				<a
					href="/import"
					class="inline-flex items-center justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
				>
					Import Cards
				</a>
			</div>
		</div>
	</div>
</div>
