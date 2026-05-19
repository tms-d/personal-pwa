<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { reloadTasks } from '$lib/store.svelte';
	import { authState, initAuth, onAuthChange, signOut } from '$lib/auth.svelte';
	import { fullSync, loadLastSyncedAt, syncStatus } from '$lib/sync.svelte';
	import SignInCard from '$lib/components/SignInCard.svelte';
	import SyncStatus from '$lib/components/SyncStatus.svelte';

	let { children } = $props();

	onMount(() => {
		loadLastSyncedAt();
		reloadTasks();
		initAuth();

		const stopAuth = onAuthChange((user) => {
			if (user) void fullSync();
		});

		const onFocus = () => {
			if (authState.user) void fullSync();
		};
		window.addEventListener('focus', onFocus);

		return () => {
			stopAuth();
			window.removeEventListener('focus', onFocus);
		};
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
	<header class="flex items-start justify-between px-4 pt-6 pb-3">
		<h1 class="text-xl font-semibold tracking-tight">Personal Priority Overview</h1>
		{#if authState.user}
			<div class="flex flex-col items-end gap-1">
				<button
					type="button"
					onclick={() => signOut()}
					class="text-stone-500 hover:text-stone-800 text-xs"
				>
					Sign out
				</button>
				{#if syncStatus.enabled}
					<SyncStatus />
				{/if}
			</div>
		{/if}
	</header>

	<nav class="flex gap-1 border-b border-stone-200 px-2">
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

	<main class="flex flex-1 flex-col gap-4 px-4 py-4">
		{@render children()}

		{#if authState.configured && !authState.loading && !authState.user}
			<SignInCard />
		{/if}
	</main>
</div>
