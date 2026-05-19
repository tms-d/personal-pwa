<script lang="ts">
	import type { TaskWithLast } from '$lib/types';
	import { computeStatus } from '$lib/tasks';
	import { completeTask, uncompleteTask, deleteTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';

	interface Props {
		task: TaskWithLast;
		showActions?: boolean;
	}

	let { task, showActions = true }: Props = $props();

	const status = $derived(computeStatus(task));

	const urgencyClasses: Record<string, string> = {
		fresh: 'border-stone-200',
		soon: 'border-amber-300 bg-amber-50',
		due: 'border-orange-400 bg-orange-50',
		overdue: 'border-red-400 bg-red-50'
	};

	const kindIcon: Record<string, string> = {
		todo: '☐',
		recurring: '↻',
		cadence: '~'
	};

	async function markDone() {
		await completeTask(task.id);
		await reloadTasks();
	}

	async function undo() {
		await uncompleteTask(task.id);
		await reloadTasks();
	}

	async function remove() {
		if (!confirm(`Delete "${task.title}"?`)) return;
		await deleteTask(task.id);
		await reloadTasks();
	}
</script>

<article
	class="flex flex-col gap-2 rounded-lg border bg-white px-4 py-3 shadow-sm {urgencyClasses[
		status.urgency
	]}"
>
	<div class="flex items-start justify-between gap-2">
		<div class="flex min-w-0 flex-1 items-start gap-2">
			<span class="mt-0.5 text-stone-400" title={task.kind}>{kindIcon[task.kind]}</span>
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-base font-medium">{task.title}</h3>
				{#if task.notes}
					<p class="mt-0.5 text-sm text-stone-500">{task.notes}</p>
				{/if}
			</div>
		</div>
		<span class="text-stone-500 shrink-0 text-xs">{status.label}</span>
	</div>
	{#if showActions}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={markDone}
				class="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
			>
				Mark done
			</button>
			{#if task.lastCompletedAt}
				<button
					type="button"
					onclick={undo}
					class="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
				>
					Undo last
				</button>
			{/if}
			<button
				type="button"
				onclick={remove}
				class="ml-auto rounded-md bg-white px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-stone-300 hover:bg-red-50"
			>
				Delete
			</button>
		</div>
	{/if}
</article>
