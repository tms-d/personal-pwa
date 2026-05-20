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

	const pageTitle = $derived(tabs.find((t) => isActive(t.href))?.label ?? 'Today');
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col">
	<header class="flex items-start justify-between px-5 pt-7 pb-4">
		<div class="flex flex-col gap-0.5">
			<span
				class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]"
			>
				Personal priority overview
			</span>
			<h1 class="text-ink text-2xl font-semibold tracking-tight">{pageTitle}</h1>
		</div>
		{#if authState.configured && !authState.loading}
			<div class="flex flex-col items-end gap-1.5">
				<SyncStatus />
				{#if authState.user}
					<button
						type="button"
						onclick={() => (signOutOpen = true)}
						class="text-ink-tertiary hover:text-ink text-xs transition-colors"
					>
						Sign out
					</button>
				{/if}
			</div>
		{/if}
	</header>

	<nav class="bg-sunken/60 mx-5 flex gap-1 rounded-full p-1">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="flex-1 rounded-full px-4 py-1.5 text-center text-sm font-medium transition-colors"
				class:bg-elevated={isActive(tab.href)}
				class:text-ink={isActive(tab.href)}
				class:shadow-paper={isActive(tab.href)}
				class:text-ink-tertiary={!isActive(tab.href)}
				class:hover:text-ink={!isActive(tab.href)}
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	<main class="flex flex-1 flex-col gap-4 px-5 py-5">
		{@render children()}
	</main>
</div>

<SignOutDialog bind:open={signOutOpen} />
