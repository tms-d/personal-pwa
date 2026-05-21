<script lang="ts">
	import type { TaskWithLast } from '$lib/types';
	import { computeStatus } from '$lib/tasks';
	import { completeTask, uncompleteTask, deleteTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';
	import { Button, Card } from '$lib/ui';
	import TaskEditDialog from './TaskEditDialog.svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		task: TaskWithLast;
		showActions?: boolean;
	}

	let { task, showActions = true }: Props = $props();
	let editing = $state(false);
	let justSnailed = $state(false);

	const status = $derived(computeStatus(task));

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
		justSnailed = true;
		await completeTask(task.id);
		setTimeout(() => {
			void reloadTasks();
		}, 900);
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
				<span class="text-success mt-0.5 shrink-0" title={task.kind}>
					{#if task.kind === 'todo'}
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M 12 20 V 12" />
							<path d="M 12 12 C 6 11 4 7 7 4 C 10 5 12 8 12 12" />
							<path d="M 12 12 C 18 11 20 7 17 4 C 14 5 12 8 12 12" />
						</svg>
					{:else if task.kind === 'recurring'}
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M 12 22 V 17" />
							<path d="M 12 17 C 9 14 9 9 12 7 C 15 9 15 14 12 17" />
							<path d="M 12 17 C 7 16 4 13 4 10 C 7 9 11 13 12 17" />
							<path d="M 12 17 C 17 16 20 13 20 10 C 17 9 13 13 12 17" />
						</svg>
					{:else}
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M 6 18 C 4 12 8 5 18 4 C 19 12 14 19 6 18 Z" />
							<path d="M 6 18 L 18 4" />
						</svg>
					{/if}
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
			{#if justSnailed}
				<span
					transition:scale={{ duration: 220, start: 0.6 }}
					class="text-success shrink-0 text-xs font-semibold"
				>
					Snailed it!
				</span>
			{:else}
				<span class="shrink-0 text-xs font-medium {statusLabelClass}">
					{status.label}
				</span>
			{/if}
		</div>
		{#if showActions}
			<div class="flex flex-wrap items-center gap-2">
				<Button size="sm" onclick={markDone} disabled={justSnailed}>Mark done</Button>
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
