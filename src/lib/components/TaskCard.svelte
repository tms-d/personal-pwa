<script lang="ts">
	import type { TaskWithLast } from '$lib/types';
	import { computeStatus } from '$lib/tasks';
	import { completeTask } from '$lib/tasks';
	import { reloadTasks, categoryStore } from '$lib/store.svelte';
	import TaskEditDialog from './TaskEditDialog.svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		task: TaskWithLast;
		showCategory?: boolean;
	}

	let { task, showCategory = false }: Props = $props();
	let editing = $state(false);
	let justSnailed = $state(false);

	const status = $derived(computeStatus(task));
	const category = $derived(
		task.categoryId ? categoryStore.items.find((c) => c.id === task.categoryId) : undefined
	);

	const statusLabelClass = $derived(
		status.urgency === 'overdue'
			? 'text-danger'
			: status.urgency === 'due'
				? 'text-accent'
				: status.urgency === 'soon'
					? 'text-warning'
					: 'text-ink-tertiary'
	);

	async function check() {
		if (justSnailed) return;
		justSnailed = true;
		await completeTask(task.id);
		setTimeout(() => {
			void reloadTasks();
			// `reloadTasks` will recompute the row; for todos it disappears, for
			// recurring/cadence it stays. justSnailed resets on next mount.
		}, 900);
	}
</script>

<article
	class="bg-elevated border-border-subtle shadow-paper relative flex items-center gap-3 overflow-hidden rounded-xl border pl-4 pr-3 py-2.5"
>
	{#if category}
		<span
			class="absolute inset-y-0 left-0 w-[5px]"
			style:background-color={category.color}
			aria-hidden="true"
		></span>
	{/if}

	<button
		type="button"
		onclick={check}
		disabled={justSnailed}
		aria-label="Mark {task.title} done"
		class="text-ink-tertiary hover:text-success border-border-strong hover:border-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 grid place-items-center h-5 w-5 rounded-full border transition-colors disabled:opacity-50 ml-0.5"
	>
		{#if justSnailed}
			<svg
				class="h-3 w-3 text-success"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				transition:scale={{ duration: 180, start: 0.4 }}
			>
				<path d="M5 12l5 5L20 7" />
			</svg>
		{/if}
	</button>

	<div class="min-w-0 flex-1">
		<div class="text-ink truncate text-sm font-medium leading-tight">
			{task.title}
		</div>
		{#if task.notes || (showCategory && category)}
			<div class="mt-0.5 flex items-center gap-2 text-[11px] text-ink-tertiary">
				{#if showCategory && category}
					<span class="inline-flex items-center gap-1">
						<span
							class="h-1.5 w-1.5 rounded-full"
							style:background-color={category.color}
							aria-hidden="true"
						></span>
						{category.name}
					</span>
				{/if}
				{#if task.notes}
					<span class="truncate">{task.notes}</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if justSnailed}
		<span
			transition:scale={{ duration: 220, start: 0.6 }}
			class="text-success shrink-0 text-xs font-semibold"
		>
			Snailed it!
		</span>
	{:else if status.label}
		<span class="shrink-0 text-xs font-medium {statusLabelClass}">{status.label}</span>
	{/if}

	<button
		type="button"
		onclick={() => (editing = true)}
		aria-label="Edit {task.title}"
		class="text-ink-tertiary hover:text-ink shrink-0 -mr-1 rounded-md p-1 transition-colors"
	>
		<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<circle cx="5" cy="12" r="1.5" />
			<circle cx="12" cy="12" r="1.5" />
			<circle cx="19" cy="12" r="1.5" />
		</svg>
	</button>
</article>

{#if editing}
	<TaskEditDialog {task} onClose={() => (editing = false)} />
{/if}
