<script lang="ts">
	import { Card } from '$lib/ui';
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

<div class="flex flex-col gap-3">
	<h2
		class="text-ink-tertiary px-1 text-[11px] font-medium uppercase tracking-[0.15em]"
	>
		When did I last…
	</h2>
	{#if sorted.length === 0}
		<p class="text-ink-tertiary px-1 text-sm">No tasks yet.</p>
	{:else}
		<Card padding="none">
			<ul class="divide-border-subtle flex flex-col divide-y">
				{#each sorted as task (task.id)}
					<li class="flex items-center justify-between px-4 py-3">
						<div class="min-w-0">
							<p class="text-ink truncate text-sm font-medium">{task.title}</p>
							<p class="text-ink-tertiary text-xs capitalize">{task.kind}</p>
						</div>
						<span class="text-ink-secondary shrink-0 text-xs font-medium">
							{formatLast(task.lastCompletedAt)}
						</span>
					</li>
				{/each}
			</ul>
		</Card>
	{/if}
</div>
