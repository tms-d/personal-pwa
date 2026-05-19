<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
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
		<p class="text-sm text-stone-500">Loading…</p>
	{:else if visible.length === 0}
		<div class="rounded-lg border border-stone-200 bg-white p-8 text-center">
			<p class="text-stone-600 text-sm">Nothing on your plate right now.</p>
			<p class="text-stone-400 mt-1 text-xs">Add tasks on the All tab.</p>
		</div>
	{:else}
		{#each visible as { task } (task.id)}
			<TaskCard {task} />
		{/each}
	{/if}
</div>
