<script lang="ts">
	import { syncStatus, fullSync } from '$lib/sync.svelte';
	import { authState, signInWithGitHub } from '$lib/auth.svelte';

	let signing = $state(false);

	async function signIn() {
		signing = true;
		try {
			await signInWithGitHub();
		} finally {
			signing = false;
		}
	}

	const label = $derived.by(() => {
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

	const dotClass = $derived(
		syncStatus.state === 'syncing'
			? 'bg-info animate-pulse'
			: syncStatus.state === 'error'
				? 'bg-danger'
				: syncStatus.pendingCount > 0
					? 'bg-warning'
					: 'bg-success'
	);
</script>

{#if !authState.user}
	<button
		type="button"
		onclick={signIn}
		disabled={signing}
		title="Sign in with GitHub to back up and sync across devices"
		class="text-ink-tertiary hover:text-ink inline-flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
	>
		<span class="bg-ink-disabled h-2 w-2 rounded-full"></span>
		{signing ? 'Redirecting…' : 'Local only · Sign in'}
	</button>
{:else}
	<button
		type="button"
		onclick={() => fullSync()}
		title={syncStatus.error ?? 'Tap to sync now'}
		class="text-ink-tertiary hover:text-ink inline-flex items-center gap-1.5 text-xs transition-colors"
	>
		<span class="h-2 w-2 rounded-full {dotClass}"></span>
		{label}
	</button>
{/if}
