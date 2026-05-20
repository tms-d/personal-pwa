<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	interface Props {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		fullWidth?: boolean;
		onclick?: (e: MouseEvent) => void;
		title?: string;
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		fullWidth = false,
		onclick,
		title,
		class: extraClass = '',
		children
	}: Props = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-paper',
		secondary:
			'bg-elevated text-ink ring-1 ring-border-strong hover:bg-sunken',
		ghost: 'text-ink-secondary hover:bg-sunken hover:text-ink',
		danger: 'bg-elevated text-danger ring-1 ring-border-subtle hover:bg-danger-soft'
	};

	const sizes: Record<Size, string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	{title}
	class="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 {variants[
		variant
	]} {sizes[size]} {fullWidth ? 'w-full' : ''} {extraClass}"
>
	{@render children()}
</button>
