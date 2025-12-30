<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Login - Cadence Cards</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<div>
			<h1 class="text-center text-3xl font-extrabold text-gray-900">Cadence Cards</h1>
			<h2 class="mt-2 text-center text-xl text-gray-600">Sign in to your account</h2>
		</div>

		{#if form?.error}
			<div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			class="mt-8 space-y-6"
			use:enhance={() => {
				isLoading = true;
				return async ({ update }) => {
					await update();
					isLoading = false;
				};
			}}
		>
			<!-- Auth.js hidden fields for credentials provider -->
			<input type="hidden" name="providerId" value="credentials" />
			<input type="hidden" name="redirectTo" value="/dashboard" />

			<div class="-space-y-px rounded-md shadow-sm">
				<div>
					<label for="email" class="sr-only">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						value={form?.email ?? ''}
						class="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						placeholder="Email address"
					/>
				</div>
				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						placeholder="Password"
					/>
				</div>
			</div>

			<div>
				<Button type="submit" fullWidth {isLoading}>Sign in</Button>
			</div>

			<div class="text-center">
				<p class="text-sm text-gray-600">
					Don't have an account?
					<a href="/register" class="font-medium text-indigo-600 hover:text-indigo-500">
						Register here
					</a>
				</p>
			</div>
		</form>
	</div>
</div>
