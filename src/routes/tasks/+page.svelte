<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import { taskStore, categoryStore } from '$lib/store.svelte';

	let categoryFilter: string | 'all' | '__uncategorized' = $state('all');

	const filtered = $derived(
		taskStore.items.filter((t) => {
			if (t.archivedAt) return false;
			if (t.kind === 'friend') return false;
			if (categoryFilter === 'all') return true;
			if (categoryFilter === '__uncategorized') return !t.categoryId;
			return t.categoryId === categoryFilter;
		})
	);

	const activeTasks = $derived(
		filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
	);

	// Hide category pills that only contain friends — they'd produce an empty
	// list when selected.
	const visibleCategories = $derived(
		categoryStore.items.filter((c) => c.kind !== 'friends')
	);
</script>

<div class="flex flex-col gap-5">
	{#if visibleCategories.length > 0}
		<div class="flex flex-wrap gap-1.5 px-1">
			<button
				type="button"
				onclick={() => (categoryFilter = 'all')}
				class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
				class:bg-accent={categoryFilter === 'all'}
				class:text-on-accent={categoryFilter === 'all'}
				class:bg-sunken={categoryFilter !== 'all'}
				class:text-ink-secondary={categoryFilter !== 'all'}
			>
				All
			</button>
			{#each visibleCategories as cat (cat.id)}
				{@const selected = categoryFilter === cat.id}
				<button
					type="button"
					onclick={() => (categoryFilter = cat.id)}
					class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
					class:bg-accent={selected}
					class:text-on-accent={selected}
					class:bg-sunken={!selected}
					class:text-ink-secondary={!selected}
				>
					<span
						class="h-2 w-2 rounded-full"
						style:background-color={cat.color}
						aria-hidden="true"
					></span>
					{cat.name}
				</button>
			{/each}
			<button
				type="button"
				onclick={() => (categoryFilter = '__uncategorized')}
				class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
				class:bg-accent={categoryFilter === '__uncategorized'}
				class:text-on-accent={categoryFilter === '__uncategorized'}
				class:bg-sunken={categoryFilter !== '__uncategorized'}
				class:text-ink-secondary={categoryFilter !== '__uncategorized'}
			>
				Uncategorized
			</button>
		</div>
	{/if}

	{#if activeTasks.length === 0}
		<p class="text-ink-tertiary px-1 text-sm">No tasks yet.</p>
	{:else}
		<section class="flex flex-col gap-3">
			{#each activeTasks as task (task.id)}
				<TaskCard {task} showCategory />
			{/each}
		</section>
	{/if}
</div>
