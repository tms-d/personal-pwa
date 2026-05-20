<script lang="ts">
	import type { TaskWithLast } from '$lib/types';
	import { computeStatus } from '$lib/tasks';
	import { completeTask, uncompleteTask, deleteTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';
	import { Button, Card } from '$lib/ui';
	import TaskEditDialog from './TaskEditDialog.svelte';

	interface Props {
		task: TaskWithLast;
		showActions?: boolean;
	}

	let { task, showActions = true }: Props = $props();
	let editing = $state(false);

	const status = $derived(computeStatus(task));

	const kindIcon: Record<string, string> = {
		todo: '☐',
		recurring: '↻',
		cadence: '~'
	};

	const statusLabelClass = $derived(
		status.urgency === 'overdue'
			? 'text-danger'
			: status.urgency === 'due'
				? 'text-accent'
				: status.urgency === 'soon'
					? 'text-warning'
					: 'text-ink-tertiary'
	);

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

<Card tone={status.urgency === 'fresh' ? 'default' : status.urgency}>
	<div class="flex flex-col gap-3">
		<div class="flex items-start justify-between gap-3">
			<div class="flex min-w-0 flex-1 items-start gap-2.5">
				<span
					class="text-ink-tertiary mt-0.5 text-base leading-none"
					title={task.kind}
				>
					{kindIcon[task.kind]}
				</span>
				<div class="min-w-0 flex-1">
					<h3 class="text-ink truncate text-base font-medium leading-snug">
						{task.title}
					</h3>
					{#if task.notes}
						<p class="text-ink-secondary mt-0.5 text-sm leading-snug">
							{task.notes}
						</p>
					{/if}
				</div>
			</div>
			<span class="shrink-0 text-xs font-medium {statusLabelClass}">
				{status.label}
			</span>
		</div>
		{#if showActions}
			<div class="flex flex-wrap items-center gap-2">
				<Button size="sm" onclick={markDone}>Mark done</Button>
				{#if task.lastCompletedAt}
					<Button variant="secondary" size="sm" onclick={undo}>
						Undo last
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					class="ml-auto"
					onclick={() => (editing = true)}
				>
					Edit
				</Button>
				<Button variant="danger" size="sm" onclick={remove}>Delete</Button>
			</div>
		{/if}
	</div>
</Card>

{#if editing}
	<TaskEditDialog {task} onClose={() => (editing = false)} />
{/if}
