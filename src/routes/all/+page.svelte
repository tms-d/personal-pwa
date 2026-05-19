<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import { taskStore } from '$lib/store.svelte';

	let showArchived = $state(false);

	const active = $derived(
		taskStore.items
			.filter((t) => !t.archivedAt)
			.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
	);

	const archived = $derived(
		taskStore.items
			.filter((t) => t.archivedAt)
			.sort((a, b) => (a.archivedAt! < b.archivedAt! ? 1 : -1))
	);
</script>

<div class="flex flex-col gap-4">
	<TaskForm />

	<section class="flex flex-col gap-3">
		<div class="flex items-center justify-between px-1">
			<h2 class="text-stone-500 text-xs font-medium uppercase tracking-wide">All tasks</h2>
			{#if archived.length > 0}
				<label class="flex items-center gap-1.5 text-xs text-stone-500">
					<input type="checkbox" bind:checked={showArchived} class="h-3.5 w-3.5" />
					Show archived ({archived.length})
				</label>
			{/if}
		</div>
		{#if active.length === 0}
			<p class="text-stone-500 px-1 text-sm">No tasks yet.</p>
		{:else}
			{#each active as task (task.id)}
				<TaskCard {task} />
			{/each}
		{/if}

		{#if showArchived && archived.length > 0}
			<h2 class="text-stone-500 mt-3 px-1 text-xs font-medium uppercase tracking-wide">Archived</h2>
			<div class="flex flex-col gap-3 opacity-60">
				{#each archived as task (task.id)}
					<TaskCard {task} />
				{/each}
			</div>
		{/if}
	</section>
</div>
