<script lang="ts">
	import { enhance } from '$app/forms';
	import { User, Lock, CheckCircle, AlertCircle } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let isUpdatingProfile = $state(false);
	let isChangingPassword = $state(false);

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Profile - Cadence Cards</title>
</svelte:head>

<div>
	<h1 class="mb-6 text-2xl font-bold text-gray-900">Profile Settings</h1>

	<div class="space-y-6">
		<!-- Profile Information -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:p-6">
				<div class="mb-4 flex items-center">
					<User class="mr-2 h-5 w-5 text-gray-400" />
					<h2 class="text-lg font-medium text-gray-900">Profile Information</h2>
				</div>

				{#if form?.success}
					<div class="mb-4 flex items-center rounded-md bg-green-50 p-3">
						<CheckCircle class="mr-2 h-4 w-4 text-green-400" />
						<span class="text-sm text-green-700">{form.message}</span>
					</div>
				{/if}

				{#if form?.error}
					<div class="mb-4 flex items-center rounded-md bg-red-50 p-3">
						<AlertCircle class="mr-2 h-4 w-4 text-red-400" />
						<span class="text-sm text-red-700">{form.error}</span>
					</div>
				{/if}

				<form
					method="POST"
					action="?/updateProfile"
					use:enhance={() => {
						isUpdatingProfile = true;
						return async ({ update }) => {
							await update();
							isUpdatingProfile = false;
						};
					}}
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="name" class="block text-sm font-medium text-gray-700">Name</label>
							<input
								type="text"
								id="name"
								name="name"
								value={data.user?.name ?? ''}
								required
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
							/>
						</div>
						<div>
							<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
							<input
								type="email"
								id="email"
								name="email"
								value={data.user?.email ?? ''}
								required
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
							/>
						</div>
					</div>

					<div class="mt-4 text-sm text-gray-500">
						Member since {data.user?.createdAt ? formatDate(data.user.createdAt) : 'Unknown'}
					</div>

					<div class="mt-4">
						<button
							type="submit"
							disabled={isUpdatingProfile}
							class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
						>
							{isUpdatingProfile ? 'Saving...' : 'Save Changes'}
						</button>
					</div>
				</form>
			</div>
		</div>

		<!-- Change Password -->
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="px-4 py-5 sm:p-6">
				<div class="mb-4 flex items-center">
					<Lock class="mr-2 h-5 w-5 text-gray-400" />
					<h2 class="text-lg font-medium text-gray-900">Change Password</h2>
				</div>

				{#if form?.passwordSuccess}
					<div class="mb-4 flex items-center rounded-md bg-green-50 p-3">
						<CheckCircle class="mr-2 h-4 w-4 text-green-400" />
						<span class="text-sm text-green-700">{form.passwordMessage}</span>
					</div>
				{/if}

				{#if form?.passwordError}
					<div class="mb-4 flex items-center rounded-md bg-red-50 p-3">
						<AlertCircle class="mr-2 h-4 w-4 text-red-400" />
						<span class="text-sm text-red-700">{form.passwordError}</span>
					</div>
				{/if}

				<form
					method="POST"
					action="?/changePassword"
					use:enhance={() => {
						isChangingPassword = true;
						return async ({ update }) => {
							await update();
							isChangingPassword = false;
						};
					}}
				>
					<div class="space-y-4">
						<div>
							<label for="currentPassword" class="block text-sm font-medium text-gray-700"
								>Current Password</label
							>
							<input
								type="password"
								id="currentPassword"
								name="currentPassword"
								required
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
							/>
						</div>
						<div>
							<label for="newPassword" class="block text-sm font-medium text-gray-700"
								>New Password</label
							>
							<input
								type="password"
								id="newPassword"
								name="newPassword"
								required
								minlength={8}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
							/>
						</div>
						<div>
							<label for="confirmPassword" class="block text-sm font-medium text-gray-700"
								>Confirm New Password</label
							>
							<input
								type="password"
								id="confirmPassword"
								name="confirmPassword"
								required
								minlength={8}
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
							/>
						</div>
					</div>

					<div class="mt-4">
						<button
							type="submit"
							disabled={isChangingPassword}
							class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
						>
							{isChangingPassword ? 'Changing...' : 'Change Password'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>
