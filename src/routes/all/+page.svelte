<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import FriendTile from '$lib/components/FriendTile.svelte';
	import { taskStore, categoryStore } from '$lib/store.svelte';
	import { computeStatus } from '$lib/tasks';

	let categoryFilter: string | 'all' | '__uncategorized' = $state('all');

	const urgencyOrder = { overdue: 0, due: 1, soon: 2, fresh: 3 } as const;

	const filtered = $derived(
		taskStore.items.filter((t) => {
			// Legacy archived rows stay hidden everywhere (archive UI is gone;
			// the column lingers as dormant data — see issue for cleanup).
			if (t.archivedAt) return false;
			if (categoryFilter === 'all') return true;
			if (categoryFilter === '__uncategorized') return !t.categoryId;
			return t.categoryId === categoryFilter;
		})
	);

	const activeTasks = $derived(
		filtered
			.filter((t) => t.kind !== 'friend')
			.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
	);
	const activeFriends = $derived(
		filtered
			.filter((t) => t.kind === 'friend')
			.sort((a, b) => {
				// Most-overdue first, calm last — keeps the dim tiles at the bottom.
				const ua = urgencyOrder[computeStatus(a).urgency];
				const ub = urgencyOrder[computeStatus(b).urgency];
				if (ua !== ub) return ua - ub;
				return a.title.localeCompare(b.title);
			})
	);

	const breachedFriendCount = $derived(
		activeFriends.filter((t) => computeStatus(t).urgency !== 'fresh').length
	);
	const calmFriendCount = $derived(activeFriends.length - breachedFriendCount);
</script>

<div class="flex flex-col gap-5">
	{#if categoryStore.items.length > 0}
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
			{#each categoryStore.items as cat (cat.id)}
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

	{#if activeTasks.length === 0 && activeFriends.length === 0}
		<p class="text-ink-tertiary px-1 text-sm">No tasks yet.</p>
	{/if}

	{#if activeTasks.length > 0}
		<section class="flex flex-col gap-3">
			<div class="flex items-baseline gap-2 px-1">
				<h3 class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]">
					Tasks
				</h3>
				<span class="text-ink-tertiary text-[11px]">{activeTasks.length}</span>
			</div>
			{#each activeTasks as task (task.id)}
				<TaskCard {task} showCategory />
			{/each}
		</section>
	{/if}

	{#if activeFriends.length > 0}
		<section class="flex flex-col gap-3">
			<div class="flex items-baseline gap-2 px-1">
				<h3 class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]">
					Friends
				</h3>
				<span class="text-ink-tertiary text-[11px]">
					{#if breachedFriendCount > 0 && calmFriendCount > 0}
						{breachedFriendCount} need attention · {calmFriendCount} calm
					{:else if breachedFriendCount > 0}
						{breachedFriendCount} need attention
					{:else}
						{calmFriendCount} calm
					{/if}
				</span>
			</div>
			<div class="grid grid-cols-2 gap-2.5">
				{#each activeFriends as task (task.id)}
					<FriendTile {task} />
				{/each}
			</div>
		</section>
	{/if}
</div>
