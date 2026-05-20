<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import { Card } from '$lib/ui';
	import { taskStore } from '$lib/store.svelte';
	import { computeStatus } from '$lib/tasks';

	const visible = $derived(
		taskStore.items
			.map((t) => ({ task: t, status: computeStatus(t) }))
			.filter((x) => x.status.visible)
			.sort((a, b) => {
				const order = { overdue: 0, due: 1, soon: 2, fresh: 3 };
				return order[a.status.urgency] - order[b.status.urgency];
			})
	);
</script>

<div class="flex flex-col gap-3">
	{#if !taskStore.loaded}
		<p class="text-ink-tertiary text-sm">Loading…</p>
	{:else if visible.length === 0}
		<Card padding="lg">
			<div class="flex flex-col items-center gap-1 py-6 text-center">
				<p class="text-ink text-base font-medium">Nothing on your plate.</p>
				<p class="text-ink-tertiary text-sm">
					Add tasks on the All tab to see what's due.
				</p>
			</div>
		</Card>
	{:else}
		{#each visible as { task } (task.id)}
			<TaskCard {task} />
		{/each}
	{/if}
</div>
