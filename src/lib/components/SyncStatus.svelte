<script lang="ts">
	import { syncStatus, fullSync } from '$lib/sync.svelte';

	const label = $derived.by(() => {
		if (syncStatus.state === 'syncing') return 'Syncing…';
		if (syncStatus.state === 'error') return 'Sync error';
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
			? 'bg-blue-500 animate-pulse'
			: syncStatus.state === 'error'
				? 'bg-red-500'
				: 'bg-green-500'
	);
</script>

<button
	type="button"
	onclick={() => fullSync()}
	title={syncStatus.error ?? 'Tap to sync now'}
	class="text-stone-500 hover:text-stone-800 inline-flex items-center gap-1.5 text-xs"
>
	<span class="h-2 w-2 rounded-full {dotClass}"></span>
	{label}
</button>
