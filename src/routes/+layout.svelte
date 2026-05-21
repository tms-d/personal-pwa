<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { reloadTasks, reloadCategories } from '$lib/store.svelte';
	import { authState, initAuth, onAuthChange, signInWithGitHub } from '$lib/auth.svelte';
	import {
		fullSync,
		loadLastSyncedAt,
		subscribeRealtime,
		unsubscribeRealtime,
		drainOutbox,
		syncStatus
	} from '$lib/sync.svelte';
	import SignOutDialog from '$lib/components/SignOutDialog.svelte';
	import TaskFormSheet from '$lib/components/TaskFormSheet.svelte';
	import { slide, fly, fade } from 'svelte/transition';

	let { children } = $props();
	let signOutOpen = $state(false);
	let taskSheetOpen = $state(false);
	let accountOpenDesktop = $state(false);
	let accountOpenMobile = $state(false);
	let signingIn = $state(false);

	async function signIn() {
		signingIn = true;
		try {
			await signInWithGitHub();
		} finally {
			signingIn = false;
		}
	}

	const syncLabel = $derived.by(() => {
		if (syncStatus.state === 'syncing') return 'Syncing…';
		if (syncStatus.state === 'error') return 'Sync error';
		if (syncStatus.pendingCount > 0) return `${syncStatus.pendingCount} pending`;
		if (syncStatus.lastSyncedAt) {
			const d = new Date(syncStatus.lastSyncedAt);
			const today = new Date();
			const sameDay = d.toDateString() === today.toDateString();
			const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			return sameDay ? `Synced ${t}` : `Synced ${d.toLocaleDateString()} ${t}`;
		}
		return 'Not synced yet';
	});

	const syncDotClass = $derived(
		syncStatus.state === 'syncing'
			? 'bg-info animate-pulse'
			: syncStatus.state === 'error'
				? 'bg-danger'
				: syncStatus.pendingCount > 0
					? 'bg-warning'
					: 'bg-success'
	);

	onMount(() => {
		loadLastSyncedAt();
		reloadTasks();
		reloadCategories();
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
		{ href: '/', label: 'Focus' },
		{ href: '/all', label: 'All' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path === '/') return 'Focus';
		if (path.startsWith('/all')) return 'All';
		if (path.startsWith('/history')) return 'History';
		if (path.startsWith('/settings')) return 'Settings';
		return 'Focus';
	});

	function closeAccountDesktop() {
		accountOpenDesktop = false;
	}
	function closeAccountMobile() {
		accountOpenMobile = false;
	}
</script>

{#snippet snailMark(cls: string)}
	<svg class={cls} viewBox="0 0 512 512" aria-hidden="true">
		<g fill="currentColor">
			<path
				d="M 88 388 C 70 428 122 440 168 436 L 340 430 Q 410 428 442 398 Q 458 376 444 360 Q 422 352 388 358 C 300 372 180 372 115 364 C 84 363 76 376 88 388 Z"
			/>
			<circle cx="210" cy="218" r="150" />
		</g>
	</svg>
{/snippet}

{#snippet plusIcon(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		aria-hidden="true"
	>
		<path d="M12 5v14M5 12h14" />
	</svg>
{/snippet}

{#snippet navIcon(href: string, cls: string)}
	{#if href === '/'}
		<svg
			class={cls}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" />
		</svg>
	{:else}
		<svg
			class={cls}
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
	{/if}
{/snippet}

{#snippet personIcon(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
	</svg>
{/snippet}

{#snippet historyIcon(cls: string)}
	<svg
		class={cls}
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
{/snippet}

{#snippet settingsIcon(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
	</svg>
{/snippet}

{#snippet signOutIconSvg(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M15 17l5-5-5-5M20 12H9M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
	</svg>
{/snippet}

{#snippet signInIconSvg(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M9 17l5-5-5-5M14 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
	</svg>
{/snippet}

{#snippet chevronIcon(cls: string)}
	<svg
		class={cls}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M6 9l6 6 6-6" />
	</svg>
{/snippet}

{#snippet accountItems(close: () => void)}
	<a
		href="/history"
		onclick={close}
		class="text-ink-secondary hover:bg-sunken hover:text-ink flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
	>
		<span class="text-ink-tertiary">{@render historyIcon('h-4 w-4')}</span>
		History
	</a>
	<a
		href="/settings"
		onclick={close}
		class="text-ink-secondary hover:bg-sunken hover:text-ink flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
	>
		<span class="text-ink-tertiary">{@render settingsIcon('h-4 w-4')}</span>
		Settings
	</a>
	<div class="border-border-subtle my-1 border-t"></div>
	{#if authState.user}
		<button
			type="button"
			onclick={() => fullSync()}
			title={syncStatus.error ?? 'Tap to sync now'}
			class="text-ink-secondary hover:bg-sunken hover:text-ink flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors"
		>
			<span class="flex h-4 w-4 items-center justify-center">
				<span class="h-2 w-2 rounded-full {syncDotClass}"></span>
			</span>
			{syncLabel}
		</button>
		<button
			type="button"
			onclick={() => {
				close();
				signOutOpen = true;
			}}
			class="text-ink-secondary hover:bg-sunken hover:text-ink flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors"
		>
			<span class="text-ink-tertiary">{@render signOutIconSvg('h-4 w-4')}</span>
			Sign out
		</button>
	{:else}
		<button
			type="button"
			onclick={signIn}
			disabled={signingIn}
			class="text-ink-secondary hover:bg-sunken hover:text-ink flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
		>
			<span class="text-ink-tertiary">{@render signInIconSvg('h-4 w-4')}</span>
			{signingIn ? 'Redirecting…' : 'Sign in with GitHub'}
		</button>
	{/if}
{/snippet}

<!-- Desktop left rail -->
<aside
	class="border-border-subtle bg-elevated/40 fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.75rem)] md:flex"
	aria-label="Primary"
>
	<a
		href="/"
		class="text-accent hover:text-accent-hover mb-6 flex items-center gap-2 px-2 transition-colors"
		aria-label="Snail — home"
	>
		{@render snailMark('h-7 w-7')}
		<span class="text-ink text-lg font-semibold tracking-tight">Snail</span>
	</a>

	<button
		type="button"
		onclick={() => (taskSheetOpen = true)}
		class="bg-accent text-on-accent hover:bg-accent-hover shadow-paper mb-4 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
	>
		{@render plusIcon('h-4 w-4')}
		New task
	</button>

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
		<div class="mt-auto flex flex-col">
			{#if accountOpenDesktop}
				<div
					transition:slide={{ duration: 180 }}
					class="border-border-subtle mb-1.5 overflow-hidden rounded-lg border bg-elevated/70 p-1.5"
					role="menu"
				>
					{@render accountItems(closeAccountDesktop)}
				</div>
			{/if}
			<button
				type="button"
				onclick={() => (accountOpenDesktop = !accountOpenDesktop)}
				aria-expanded={accountOpenDesktop}
				aria-label="Account"
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
				class:bg-sunken={accountOpenDesktop}
				class:hover:bg-sunken={!accountOpenDesktop}
			>
				<span
					class="bg-accent-soft text-accent flex h-7 w-7 items-center justify-center rounded-full"
				>
					{@render personIcon('h-4 w-4')}
				</span>
				<span class="text-ink flex-1 text-left text-sm font-medium">Account</span>
				<span class="text-ink-tertiary transition-transform" class:rotate-180={!accountOpenDesktop}>
					{@render chevronIcon('h-3.5 w-3.5')}
				</span>
			</button>
		</div>
	{/if}
</aside>

<!-- Main column -->
<div class="md:pl-60">
	<div class="mx-auto flex min-h-screen max-w-2xl flex-col">
		<header
			class="flex items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:pt-[calc(env(safe-area-inset-top)+1.75rem)]"
		>
			<h1 class="text-ink text-2xl font-semibold tracking-tight">
				{pageTitle}
			</h1>

			{#if authState.configured && !authState.loading}
				<button
					type="button"
					onclick={() => (accountOpenMobile = true)}
					aria-label="Account"
					class="bg-sunken text-ink-tertiary hover:text-ink flex h-9 w-9 items-center justify-center rounded-full transition-colors md:hidden"
				>
					{@render personIcon('h-[18px] w-[18px]')}
				</button>
			{/if}
		</header>

		<main
			class="flex flex-1 flex-col gap-4 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-10"
		>
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile bottom bar: Focus | + | All -->
<nav
	class="border-border-subtle bg-elevated/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom);"
	aria-label="Primary"
>
	<div class="grid grid-cols-3 items-stretch">
		<a
			href="/"
			class="flex flex-col items-center gap-1 py-2.5 transition-colors"
			class:text-accent={isActive('/')}
			class:text-ink-tertiary={!isActive('/')}
			aria-current={isActive('/') ? 'page' : undefined}
		>
			{@render navIcon('/', 'h-[22px] w-[22px]')}
			<span class="text-[11px] font-medium">Focus</span>
		</a>

		<div class="flex items-center justify-center py-1.5">
			<button
				type="button"
				onclick={() => (taskSheetOpen = true)}
				aria-label="New task"
				class="bg-accent text-on-accent hover:bg-accent-hover shadow-paper flex h-12 w-12 items-center justify-center rounded-full transition-colors"
			>
				{@render plusIcon('h-6 w-6')}
			</button>
		</div>

		<a
			href="/all"
			class="flex flex-col items-center gap-1 py-2.5 transition-colors"
			class:text-accent={isActive('/all')}
			class:text-ink-tertiary={!isActive('/all')}
			aria-current={isActive('/all') ? 'page' : undefined}
		>
			{@render navIcon('/all', 'h-[22px] w-[22px]')}
			<span class="text-[11px] font-medium">All</span>
		</a>
	</div>
</nav>

<!-- Mobile account drawer (slides in from the right) -->
{#if accountOpenMobile}
	<button
		type="button"
		aria-label="Close account menu"
		class="fixed inset-0 z-50 cursor-default bg-black/40 backdrop-blur-sm md:hidden"
		onclick={closeAccountMobile}
		transition:fade={{ duration: 150 }}
	></button>
	<div
		class="bg-elevated border-border-subtle fixed inset-y-0 right-0 z-50 flex w-[min(86vw,320px)] flex-col border-l shadow-[var(--shadow-paper-overlay)] md:hidden"
		role="dialog"
		aria-label="Account"
		transition:fly={{ x: 360, duration: 220 }}
	>
		<header
			class="border-border-subtle flex items-center justify-between border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)]"
		>
			<span class="text-ink text-sm font-semibold">Account</span>
			<button
				type="button"
				onclick={closeAccountMobile}
				aria-label="Close"
				class="text-ink-tertiary hover:text-ink -mr-1 rounded-md p-1 transition-colors"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</header>
		<div
			class="flex flex-1 flex-col gap-0.5 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
		>
			{@render accountItems(closeAccountMobile)}
		</div>
	</div>
{/if}

<TaskFormSheet bind:open={taskSheetOpen} />
<SignOutDialog bind:open={signOutOpen} />
