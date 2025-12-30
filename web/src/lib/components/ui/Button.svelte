<script lang="ts">
	import type { Snippet } from 'svelte';

	type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
	type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

	interface Props {
		children: Snippet;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		disabled?: boolean;
		isLoading?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (e: MouseEvent) => void;
		icon?: Snippet;
		href?: string;
		fullWidth?: boolean;
	}

	let {
		children,
		variant = 'primary',
		size = 'md',
		class: className = '',
		disabled = false,
		isLoading = false,
		type = 'button',
		onclick,
		icon,
		href,
		fullWidth = false
	}: Props = $props();

	const baseClasses =
		'inline-flex items-center justify-center border font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2';

	const variantClasses: Record<ButtonVariant, string> = {
		primary:
			'border-transparent text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 disabled:bg-indigo-400',
		secondary:
			'border-transparent text-white bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-400',
		danger:
			'border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400',
		success:
			'border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500 disabled:bg-green-400',
		outline:
			'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400'
	};

	const sizeClasses: Record<ButtonSize, string> = {
		xs: 'px-2.5 py-1.5 text-xs',
		sm: 'px-3 py-2 text-sm',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base'
	};

	let widthClass = $derived(fullWidth ? 'w-full' : '');
	let classes = $derived(
		`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`
	);
</script>

{#if href}
	<a {href} class="{classes} {disabled ? 'pointer-events-none opacity-50' : ''}">
		{#if isLoading}
			<svg
				class="mr-2 -ml-1 h-4 w-4 animate-spin text-current"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		{:else if icon}
			<span class="mr-2">{@render icon()}</span>
		{/if}
		{@render children()}
	</a>
{:else}
	<button {type} class={classes} disabled={disabled || isLoading} {onclick}>
		{#if isLoading}
			<svg
				class="mr-2 -ml-1 h-4 w-4 animate-spin text-current"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		{:else if icon}
			<span class="mr-2">{@render icon()}</span>
		{/if}
		{@render children()}
	</button>
{/if}
