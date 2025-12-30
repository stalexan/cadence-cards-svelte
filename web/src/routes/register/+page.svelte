<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';

	interface RegisterFormData {
		error?: string;
		name?: string;
		email?: string;
	}

	interface Props {
		form: RegisterFormData | null;
	}

	let { form }: Props = $props();

	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Register - Cadence Cards</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<div>
			<h1 class="text-center text-3xl font-extrabold text-gray-900">Cadence Cards</h1>
			<h2 class="mt-2 text-center text-xl text-gray-600">Create your account</h2>
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
			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700">Name</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						value={form?.name ?? ''}
						class="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						placeholder="Your name"
					/>
				</div>
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						value={form?.email ?? ''}
						class="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						placeholder="Email address"
					/>
				</div>
				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						class="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						placeholder="Password (min. 8 characters)"
					/>
				</div>
				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-gray-700"
						>Confirm Password</label
					>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						required
						class="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
						placeholder="Confirm your password"
					/>
				</div>
			</div>

			<div>
				<Button type="submit" fullWidth {isLoading}>Create Account</Button>
			</div>

			<div class="text-center">
				<p class="text-sm text-gray-600">
					Already have an account?
					<a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
						Sign in here
					</a>
				</p>
			</div>
		</form>
	</div>
</div>
