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

{#snippet navIcon(href: string, sizeClass: string)}
	{#if href === '/'}
		<svg
			class={sizeClass}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="5" width="18" height="16" rx="2.5" />
			<path d="M16 3v4M8 3v4M3 10h18" />
			<path d="M9 15.5l2 2 4-4" />
		</svg>
	{:else if href === '/all'}
		<svg
			class={sizeClass}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M8 6h13M8 12h13M8 18h13" />
			<circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
			<circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
			<circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
		</svg>
	{:else}
		<svg
			class={sizeClass}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
			<path d="M3 3v5h5" />
			<path d="M12 7v5l3 2" />
		</svg>
	{/if}
{/snippet}

<!-- Desktop left rail -->
<aside
	class="border-border-subtle bg-elevated/40 fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r px-4 py-7 md:flex"
	aria-label="Primary"
>
	<nav class="flex flex-col gap-1">
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
				class:bg-sunken={active}
				class:text-ink={active}
				class:text-ink-secondary={!active}
				class:hover:bg-sunken={!active}
				class:hover:text-ink={!active}
				aria-current={active ? 'page' : undefined}
			>
				<span class:text-accent={active} class:text-ink-tertiary={!active}>
					{@render navIcon(tab.href, 'h-5 w-5')}
				</span>
				{tab.label}
			</a>
		{/each}
	</nav>

	{#if authState.configured && !authState.loading}
		<div
			class="border-border-subtle mt-auto flex flex-col items-start gap-2 border-t px-3 pt-4"
		>
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
</aside>

<!-- Main column -->
<div class="md:pl-60">
	<div class="mx-auto flex min-h-screen max-w-2xl flex-col">
		<header class="flex items-start justify-between px-5 pt-7 pb-4">
			<div class="flex flex-col gap-0.5">
				<span
					class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]"
				>
					Personal priority overview
				</span>
				<h1 class="text-ink text-2xl font-semibold tracking-tight">
					{pageTitle}
				</h1>
			</div>
			{#if authState.configured && !authState.loading}
				<div class="flex flex-col items-end gap-1.5 md:hidden">
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

		<main
			class="flex flex-1 flex-col gap-4 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-10"
		>
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile bottom tab bar -->
<nav
	class="border-border-subtle bg-elevated/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom);"
	aria-label="Primary"
>
	<div class="grid grid-cols-3">
		{#each tabs as tab (tab.href)}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				class="flex flex-col items-center gap-1 py-2.5 transition-colors"
				class:text-accent={active}
				class:text-ink-tertiary={!active}
				aria-current={active ? 'page' : undefined}
			>
				{@render navIcon(tab.href, 'h-[22px] w-[22px]')}
				<span class="text-[11px] font-medium">{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>

<SignOutDialog bind:open={signOutOpen} />
