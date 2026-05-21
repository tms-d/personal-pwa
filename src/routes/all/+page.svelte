<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
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

<div class="flex flex-col gap-5">
	<section class="flex flex-col gap-3">
		<div class="flex items-center justify-between px-1">
			<h2
				class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]"
			>
				All tasks
			</h2>
			{#if archived.length > 0}
				<label class="text-ink-tertiary flex items-center gap-1.5 text-xs">
					<input
						type="checkbox"
						bind:checked={showArchived}
						class="accent-accent h-3.5 w-3.5"
					/>
					Show archived ({archived.length})
				</label>
			{/if}
		</div>
		{#if active.length === 0}
			<p class="text-ink-tertiary px-1 text-sm">No tasks yet.</p>
		{:else}
			{#each active as task (task.id)}
				<TaskCard {task} />
			{/each}
		{/if}

		{#if showArchived && archived.length > 0}
			<h2
				class="text-ink-tertiary mt-3 px-1 text-[11px] font-medium uppercase tracking-[0.15em]"
			>
				Archived
			</h2>
			<div class="flex flex-col gap-3 opacity-60">
				{#each archived as task (task.id)}
					<TaskCard {task} />
				{/each}
			</div>
		{/if}
	</section>
</div>
