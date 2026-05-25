<script lang="ts">
	import FriendTile from '$lib/components/FriendTile.svelte';
	import { taskStore } from '$lib/store.svelte';
	import { computeStatus } from '$lib/tasks';
	import type { TaskWithLast } from '$lib/types';

	// Sort by how much time you have left to contact them, ascending.
	// `overdueDays = daysSinceContacted - contactedTargetDays`, so a positive
	// value means you're already late, zero means due today, negative means
	// you still have time. Larger overdue → more urgent → sorts first.
	function contactedOverdueDays(t: TaskWithLast): number {
		const s = computeStatus(t);
		return s.streams?.contacted.overdueDays ?? Number.NEGATIVE_INFINITY;
	}

	const friends = $derived(
		taskStore.items
			.filter((t) => t.kind === 'friend' && !t.archivedAt)
			.sort((a, b) => {
				const oa = contactedOverdueDays(a);
				const ob = contactedOverdueDays(b);
				if (oa !== ob) return ob - oa;
				return a.title.localeCompare(b.title);
			})
	);

	const urgentCount = $derived(
		friends.filter((t) => contactedOverdueDays(t) > 0).length
	);
</script>

<div class="flex flex-col gap-5">
	{#if !taskStore.loaded}
		<p class="text-ink-tertiary text-sm">Loading…</p>
	{:else if friends.length === 0}
		<div class="border-border-subtle bg-elevated/60 rounded-2xl border px-5 py-10 text-center">
			<p class="text-ink text-base font-medium">No friends yet.</p>
			<p class="text-ink-tertiary mt-1 text-sm">
				Use the + in the header to add someone you want to stay in touch with.
			</p>
		</div>
	{:else}
		{#if urgentCount > 0}
			<p class="text-ink-tertiary px-1 text-xs">
				<span class="text-danger font-semibold">{urgentCount}</span>
				overdue — swipe right when you've contacted them.
			</p>
		{/if}
		<div class="grid grid-cols-2 gap-2.5">
			{#each friends as task (task.id)}
				<FriendTile {task} />
			{/each}
		</div>
	{/if}
</div>
