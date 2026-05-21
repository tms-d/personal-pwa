<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import FriendTile from '$lib/components/FriendTile.svelte';
	import { taskStore, categoryStore } from '$lib/store.svelte';
	import { computeStatus } from '$lib/tasks';
	import type { TaskWithLast } from '$lib/types';

	let showArchived = $state(false);
	let categoryFilter: string | 'all' | '__uncategorized' = $state('all');

	const urgencyOrder = { overdue: 0, due: 1, soon: 2, fresh: 3 } as const;

	const filtered = $derived(
		taskStore.items.filter((t) => {
			if (categoryFilter === 'all') return true;
			if (categoryFilter === '__uncategorized') return !t.categoryId;
			return t.categoryId === categoryFilter;
		})
	);

	const active = $derived(filtered.filter((t) => !t.archivedAt));
	const archived = $derived(
		filtered
			.filter((t) => t.archivedAt)
			.sort((a, b) => (a.archivedAt! < b.archivedAt! ? 1 : -1))
	);

	const activeTasks = $derived(
		active.filter((t) => t.kind !== 'friend').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
	);
	const activeFriends = $derived(
		active
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

	function archivedFriends(list: TaskWithLast[]): TaskWithLast[] {
		return list.filter((t) => t.kind === 'friend');
	}
	function archivedNonFriends(list: TaskWithLast[]): TaskWithLast[] {
		return list.filter((t) => t.kind !== 'friend');
	}
</script>

<div class="flex flex-col gap-5">
	<div class="flex items-center justify-between gap-3 px-1">
		<h2 class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]">
			All
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

	{#if showArchived && archived.length > 0}
		{@const archivedNF = archivedNonFriends(archived)}
		{@const archivedF = archivedFriends(archived)}
		<h2
			class="text-ink-tertiary mt-3 px-1 text-[11px] font-medium uppercase tracking-[0.15em]"
		>
			Archived
		</h2>
		{#if archivedNF.length > 0}
			<div class="flex flex-col gap-3 opacity-60">
				{#each archivedNF as task (task.id)}
					<TaskCard {task} showCategory />
				{/each}
			</div>
		{/if}
		{#if archivedF.length > 0}
			<div class="grid grid-cols-2 gap-2.5 opacity-60">
				{#each archivedF as task (task.id)}
					<FriendTile {task} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
