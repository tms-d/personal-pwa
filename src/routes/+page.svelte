<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import { Card } from '$lib/ui';
	import { taskStore, categoryStore } from '$lib/store.svelte';
	import { computeStatus } from '$lib/tasks';
	import type { TaskWithLast, Category } from '$lib/types';

	const urgencyOrder = { overdue: 0, due: 1, soon: 2, fresh: 3 } as const;

	// Focus is task-only. Friends have their own tab — see issue #41.
	// Cadence tasks still surface here when they're past the "soon"
	// threshold (last ~30% of their target). Calm ones live on Tasks.
	function shouldShowOnFocus(t: TaskWithLast): boolean {
		if (t.kind === 'friend') return false;
		const s = computeStatus(t);
		if (!s.visible) return false;
		if (t.kind === 'cadence') return s.urgency !== 'fresh';
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
			if (cat.kind === 'friends') continue;
			const tasks = byCategory.get(cat.id);
			if (tasks && tasks.length > 0) result.push({ category: cat, tasks });
		}
		const uncategorized = byCategory.get(null);
		if (uncategorized && uncategorized.length > 0) {
			result.push({ category: null, tasks: uncategorized });
		}
		return result;
	});

	const hasAnyCategories = $derived(
		categoryStore.items.some((c) => c.kind !== 'friends')
	);
</script>

<div class="flex flex-col gap-5">
	{#if !taskStore.loaded}
		<p class="text-ink-tertiary text-sm">Loading…</p>
	{:else if visible.length === 0}
		<Card padding="lg">
			<div class="flex flex-col items-center gap-1 py-6 text-center">
				<p class="text-ink text-base font-medium">Nothing on your plate.</p>
				<p class="text-ink-tertiary text-sm">
					Add tasks on the Tasks tab to see what's due.
				</p>
			</div>
		</Card>
	{:else if !hasAnyCategories}
		<div class="flex flex-col gap-3">
			{#each visible as { task } (task.id)}
				<TaskCard {task} />
			{/each}
		</div>
	{:else}
		{#each groups as group (group.category?.id ?? '__uncategorized')}
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
				{#each group.tasks as task (task.id)}
					<TaskCard {task} />
				{/each}
			</section>
		{/each}
	{/if}
</div>
