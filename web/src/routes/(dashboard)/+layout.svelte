<script lang="ts">
	import { page } from '$app/stores';
	import { signOut } from '@auth/sveltekit/client';
	import {
		Home,
		BookOpen,
		Folder,
		FileText,
		MessageCircle,
		User,
		LogOut,
		Menu,
		X
	} from 'lucide-svelte';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	let isMobileMenuOpen = $state(false);

	const navigation = [
		{ name: 'Dashboard', href: '/dashboard', icon: Home },
		{ name: 'Topics', href: '/topics', icon: Folder },
		{ name: 'Decks', href: '/decks', icon: BookOpen },
		{ name: 'Cards', href: '/cards', icon: FileText },
		{ name: 'Study', href: '/study', icon: BookOpen },
		{ name: 'Chat', href: '/chat', icon: MessageCircle },
		{ name: 'Profile', href: '/profile', icon: User }
	];

	function isCurrent(href: string): boolean {
		const pathname = $page.url.pathname;
		return pathname === href || pathname.startsWith(href + '/');
	}

	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	async function handleSignOut() {
		await signOut({ callbackUrl: '/login' });
	}

	const userName = $derived(data.user?.name || data.user?.email || 'User');
	const userInitial = $derived(userName.charAt(0).toUpperCase());
</script>

<div class="min-h-screen bg-gray-100">
	<!-- Mobile menu button -->
	<div
		class="fixed top-0 right-0 left-0 z-50 flex items-center justify-between bg-white p-4 shadow-md lg:hidden"
	>
		<span class="text-xl font-bold text-indigo-600">Cadence Cards</span>
		<button type="button" class="text-gray-500 hover:text-gray-600" onclick={toggleMobileMenu}>
			<span class="sr-only">Open menu</span>
			{#if isMobileMenuOpen}
				<X class="h-6 w-6" />
			{:else}
				<Menu class="h-6 w-6" />
			{/if}
		</button>
	</div>

	<!-- Mobile menu -->
	{#if isMobileMenuOpen}
		<div class="fixed inset-0 z-40 bg-white pt-16 lg:hidden">
			<div class="space-y-1 pt-2 pb-3">
				{#each navigation as item (item.href)}
					<a
						href={item.href}
						class="block border-l-4 py-3 pr-4 pl-3 text-base font-medium {isCurrent(item.href)
							? 'border-indigo-600 bg-indigo-50 text-indigo-600'
							: 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800'}"
						onclick={() => (isMobileMenuOpen = false)}
					>
						<div class="flex items-center">
							<item.icon class="mr-3 h-6 w-6 flex-shrink-0" />
							{item.name}
						</div>
					</a>
				{/each}
				<button
					onclick={handleSignOut}
					class="block w-full border-l-4 border-transparent py-3 pr-4 pl-3 text-left text-base font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
				>
					<div class="flex items-center">
						<LogOut class="mr-3 h-6 w-6 flex-shrink-0" />
						Sign Out
					</div>
				</button>
			</div>
			<!-- Version number for mobile -->
			<div class="border-t border-gray-200 px-3 py-3">
				<p class="text-xs text-gray-400">Version {data.appVersion}</p>
			</div>
		</div>
	{/if}

	<!-- Desktop sidebar -->
	<div class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
		<div class="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
			<div class="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
				<div class="flex flex-shrink-0 items-center px-4">
					<span class="text-2xl font-bold text-indigo-600">Cadence Cards</span>
				</div>
				<nav class="mt-8 flex-1 space-y-1 bg-white px-2">
					{#each navigation as item (item.href)}
						<a
							href={item.href}
							class="group flex items-center rounded-md px-2 py-2 text-sm font-medium {isCurrent(
								item.href
							)
								? 'bg-indigo-50 text-indigo-600'
								: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
						>
							<item.icon
								class="mr-3 h-6 w-6 flex-shrink-0 {isCurrent(item.href)
									? 'text-indigo-600'
									: 'text-gray-400 group-hover:text-gray-500'}"
							/>
							{item.name}
						</a>
					{/each}
				</nav>
			</div>
			<div class="flex flex-shrink-0 border-t border-gray-200 p-4">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-500"
						>
							{userInitial}
						</div>
					</div>
					<div class="ml-3">
						<p class="truncate text-sm font-medium text-gray-700">{userName}</p>
						<button
							onclick={handleSignOut}
							class="flex items-center text-xs font-medium text-gray-500 hover:text-indigo-500"
						>
							<LogOut class="mr-1 h-3 w-3" />
							Sign Out
						</button>
					</div>
				</div>
			</div>
			<!-- Version number -->
			<div class="border-t border-gray-200 px-4 py-2">
				<p class="text-xs text-gray-400">v{data.appVersion}</p>
			</div>
		</div>
	</div>

	<!-- Main content -->
	<div class="flex min-h-screen flex-col lg:pl-64">
		<div class="h-16 lg:hidden"></div>
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>
</div>
