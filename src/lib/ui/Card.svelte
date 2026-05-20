<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'default' | 'soon' | 'due' | 'overdue';
	type Padding = 'sm' | 'md' | 'lg' | 'none';

	interface Props {
		tone?: Tone;
		padding?: Padding;
		as?: 'article' | 'div' | 'section';
		class?: string;
		children: Snippet;
	}

	let {
		tone = 'default',
		padding = 'md',
		as = 'article',
		class: extraClass = '',
		children
	}: Props = $props();

	const tones: Record<Tone, string> = {
		default: 'bg-elevated border-border-subtle',
		soon: 'bg-warning-soft border-warning/30',
		due: 'bg-accent-soft border-accent/30',
		overdue: 'bg-danger-soft border-danger/40'
	};

	const paddings: Record<Padding, string> = {
		none: '',
		sm: 'px-3 py-2.5',
		md: 'px-4 py-3.5',
		lg: 'p-5'
	};

	const cls = $derived(
		`rounded-xl border shadow-paper ${tones[tone]} ${paddings[padding]} ${extraClass}`
	);
</script>

{#if as === 'div'}
	<div class={cls}>{@render children()}</div>
{:else if as === 'section'}
	<section class={cls}>{@render children()}</section>
{:else}
	<article class={cls}>{@render children()}</article>
{/if}
