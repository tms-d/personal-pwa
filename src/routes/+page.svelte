<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import FriendTile from '$lib/components/FriendTile.svelte';
	import { Card } from '$lib/ui';
	import { taskStore, categoryStore } from '$lib/store.svelte';
	import { computeStatus } from '$lib/tasks';
	import type { TaskWithLast, Category } from '$lib/types';

	const urgencyOrder = { overdue: 0, due: 1, soon: 2, fresh: 3 } as const;

	// Friends only surface on Focus when at least one stream is breached
	// (urgency > fresh). Calm friends live on the All tab.
	function shouldShowOnFocus(t: TaskWithLast): boolean {
		const s = computeStatus(t);
		if (!s.visible) return false;
		if (t.kind === 'friend') return s.urgency !== 'fresh';
		return true;
	}

	const visible = $derived(
		taskStore.items
			.filter(shouldShowOnFocus)
			.map((t) => ({ task: t, status: computeStatus(t) }))
			.sort((a, b) => urgencyOrder[a.status.urgency] - urgencyOrder[b.status.urgency])
	);

	interface Group {
		category: Category | null;
		tasks: TaskWithLast[];
	}

	const groups = $derived.by<Group[]>(() => {
		const live = new Set(categoryStore.items.map((c) => c.id));
		const byCategory = new Map<string | null, TaskWithLast[]>();
		for (const { task } of visible) {
			const key = task.categoryId && live.has(task.categoryId) ? task.categoryId : null;
			const list = byCategory.get(key) ?? [];
			list.push(task);
			byCategory.set(key, list);
		}
		const result: Group[] = [];
		for (const cat of categoryStore.items) {
			const tasks = byCategory.get(cat.id);
			if (tasks && tasks.length > 0) result.push({ category: cat, tasks });
		}
		const uncategorized = byCategory.get(null);
		if (uncategorized && uncategorized.length > 0) {
			result.push({ category: null, tasks: uncategorized });
		}
		return result;
	});

	const hasAnyCategories = $derived(categoryStore.items.length > 0);

	function partitionByKind(tasks: TaskWithLast[]) {
		const friends: TaskWithLast[] = [];
		const others: TaskWithLast[] = [];
		for (const t of tasks) (t.kind === 'friend' ? friends : others).push(t);
		return { friends, others };
	}
</script>

<div class="flex flex-col gap-5">
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
	{:else if !hasAnyCategories}
		{@const { friends, others } = partitionByKind(visible.map((v) => v.task))}
		{#if others.length > 0}
			<div class="flex flex-col gap-3">
				{#each others as task (task.id)}
					<TaskCard {task} />
				{/each}
			</div>
		{/if}
		{#if friends.length > 0}
			<div class="grid grid-cols-2 gap-2.5">
				{#each friends as task (task.id)}
					<FriendTile {task} showCategoryDot={false} />
				{/each}
			</div>
		{/if}
	{:else}
		{#each groups as group (group.category?.id ?? '__uncategorized')}
			{@const { friends, others } = partitionByKind(group.tasks)}
			<section class="flex flex-col gap-3">
				<div class="flex items-center gap-2 px-1">
					{#if group.category}
						<span
							class="border-border-subtle h-3 w-3 rounded-full border"
							style:background-color={group.category.color}
							aria-hidden="true"
						></span>
						<h2
							class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]"
						>
							{group.category.name}
						</h2>
					{:else}
						<h2
							class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em]"
						>
							Uncategorized
						</h2>
					{/if}
				</div>
				{#each others as task (task.id)}
					<TaskCard {task} />
				{/each}
				{#if friends.length > 0}
					<div class="grid grid-cols-2 gap-2.5">
						{#each friends as task (task.id)}
							<FriendTile {task} showCategoryDot={false} />
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	{/if}
</div>
