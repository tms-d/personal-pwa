<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { reloadTasks } from '$lib/store.svelte';

	let { children } = $props();

	onMount(() => {
		reloadTasks();
	});

	const tabs = [
		{ href: '/', label: 'Today' },
		{ href: '/all', label: 'All' },
		{ href: '/history', label: 'History' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col">
	<header class="px-4 pt-6 pb-3">
		<h1 class="text-xl font-semibold tracking-tight">Personal Priority Overview</h1>
	</header>
	<nav class="border-stone-200 flex gap-1 border-b px-2">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="rounded-t-md px-4 py-2 text-sm font-medium transition-colors"
				class:bg-white={isActive(tab.href)}
				class:text-stone-900={isActive(tab.href)}
				class:text-stone-500={!isActive(tab.href)}
				class:hover:text-stone-800={!isActive(tab.href)}
			>
				{tab.label}
			</a>
		{/each}
	</nav>
	<main class="flex-1 px-4 py-4">
		{@render children()}
	</main>
</div>
