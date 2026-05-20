<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { reloadTasks } from '$lib/store.svelte';
	import { authState, initAuth, onAuthChange } from '$lib/auth.svelte';
	import {
		fullSync,
		loadLastSyncedAt,
		subscribeRealtime,
		unsubscribeRealtime,
		drainOutbox
	} from '$lib/sync.svelte';
	import SyncStatus from '$lib/components/SyncStatus.svelte';
	import SignOutDialog from '$lib/components/SignOutDialog.svelte';

	let { children } = $props();
	let signOutOpen = $state(false);

	onMount(() => {
		loadLastSyncedAt();
		reloadTasks();
		initAuth();

		const stopAuth = onAuthChange(async (user) => {
			if (user) {
				subscribeRealtime();
				await fullSync();
			} else {
				await unsubscribeRealtime();
			}
		});

		const onFocus = () => {
			if (authState.user) void fullSync();
		};
		const onOnline = () => {
			if (authState.user) void drainOutbox();
		};
		window.addEventListener('focus', onFocus);
		window.addEventListener('online', onOnline);

		return () => {
			stopAuth();
			window.removeEventListener('focus', onFocus);
			window.removeEventListener('online', onOnline);
			void unsubscribeRealtime();
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
		{#if authState.configured && !authState.loading}
			<div class="flex flex-col items-end gap-1">
				<SyncStatus />
				{#if authState.user}
					<button
						type="button"
						onclick={() => (signOutOpen = true)}
						class="text-stone-500 hover:text-stone-800 text-xs"
					>
						Sign out
					</button>
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
	</main>
</div>

<SignOutDialog bind:open={signOutOpen} />
