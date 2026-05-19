<script lang="ts">
	import { taskStore } from '$lib/store.svelte';
	import { daysSince } from '$lib/tasks';

	const sorted = $derived(
		[...taskStore.items]
			.filter((t) => !t.archivedAt)
			.sort((a, b) => {
				const aTime = a.lastCompletedAt ?? '';
				const bTime = b.lastCompletedAt ?? '';
				return aTime < bTime ? 1 : -1;
			})
	);

	function formatLast(iso: string | null): string {
		if (!iso) return 'never';
		const d = daysSince(iso);
		if (d === 0) return 'today';
		if (d === 1) return 'yesterday';
		return `${d} days ago`;
	}
</script>

<div class="flex flex-col gap-2">
	<h2 class="text-stone-500 px-1 text-xs font-medium uppercase tracking-wide">When did I last…</h2>
	{#if sorted.length === 0}
		<p class="text-stone-500 px-1 text-sm">No tasks yet.</p>
	{:else}
		<ul class="flex flex-col divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
			{#each sorted as task (task.id)}
				<li class="flex items-center justify-between px-4 py-3">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium">{task.title}</p>
						<p class="text-stone-500 text-xs capitalize">{task.kind}</p>
					</div>
					<span class="text-stone-700 shrink-0 text-xs">{formatLast(task.lastCompletedAt)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
