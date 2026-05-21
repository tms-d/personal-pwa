<script lang="ts">
	import type { TaskWithLast, CompletionStream } from '$lib/types';
	import { computeStatus, type Urgency, type ComputedStreamStatus } from '$lib/tasks';
	import { completeTask } from '$lib/tasks';
	import { reloadTasks, categoryStore } from '$lib/store.svelte';
	import TaskEditDialog from './TaskEditDialog.svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		task: TaskWithLast;
		showCategoryDot?: boolean;
	}

	let { task, showCategoryDot = true }: Props = $props();
	let editing = $state(false);
	let justStreamed = $state<CompletionStream | null>(null);

	const status = $derived(computeStatus(task));
	const category = $derived(
		task.categoryId ? categoryStore.items.find((c) => c.id === task.categoryId) : undefined
	);

	function streamColor(u: Urgency): string {
		return u === 'overdue'
			? 'text-danger'
			: u === 'due'
				? 'text-accent'
				: u === 'soon'
					? 'text-warning'
					: 'text-ink-secondary';
	}

	function toneClass(u: Urgency): string {
		return u === 'overdue'
			? 'bg-danger-soft border-danger/35'
			: u === 'due'
				? 'bg-accent-soft border-accent/30'
				: u === 'soon'
					? 'bg-warning-soft border-warning/30'
					: 'bg-elevated border-border-subtle opacity-65';
	}

	async function logStream(stream: CompletionStream) {
		justStreamed = stream;
		await completeTask(task.id, new Date(), stream);
		setTimeout(() => {
			justStreamed = null;
			void reloadTasks();
		}, 700);
	}

	function targetFor(stream: CompletionStream): number {
		return stream === 'contacted'
			? (task.contactedTargetDays ?? 14)
			: (task.seenTargetDays ?? 60);
	}

	function daysLabel(s: ComputedStreamStatus, stream: CompletionStream): string {
		if (s.label === 'never') return '—';
		const since = targetFor(stream) + s.overdueDays;
		return `${since}d`;
	}
</script>

<article class="flex flex-col gap-3 rounded-2xl border p-3.5 shadow-paper {toneClass(status.urgency)}">
	<div class="flex items-center gap-2 min-w-0">
		{#if showCategoryDot && category}
			<span
				class="h-2 w-2 rounded-full shrink-0"
				style:background-color={category.color}
				aria-hidden="true"
			></span>
		{/if}
		<span class="text-ink truncate text-sm font-semibold leading-tight flex-1">{task.title}</span>
		<button
			type="button"
			onclick={() => (editing = true)}
			aria-label="Edit {task.title}"
			class="text-ink-tertiary hover:text-ink -m-1 p-1 rounded-md transition-colors shrink-0"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<circle cx="5" cy="12" r="1.5" />
				<circle cx="12" cy="12" r="1.5" />
				<circle cx="19" cy="12" r="1.5" />
			</svg>
		</button>
	</div>

	{#if status.streams}
		<div class="flex flex-col gap-1.5 mt-auto">
			{#each [['contacted', status.streams.contacted], ['seen', status.streams.seen]] as const as [stream, s] (stream)}
				<button
					type="button"
					onclick={() => logStream(stream)}
					aria-label="Log {stream} for {task.title}"
					class="flex items-baseline gap-2 rounded-md -mx-1 px-1 py-0.5 hover:bg-black/[0.04] active:bg-black/[0.06] transition-colors text-left"
				>
					<span class="text-ink-tertiary shrink-0 self-center">
						{#if stream === 'contacted'}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path
									d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
								/>
							</svg>
						{:else}
							<svg
								class="h-3.5 w-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{/if}
					</span>
					{#if justStreamed === stream}
						<span
							transition:scale={{ duration: 220, start: 0.6 }}
							class="text-success text-sm font-semibold leading-none"
						>
							Snailed it!
						</span>
					{:else}
						<span class="text-lg font-semibold leading-none tabular-nums {streamColor(s.urgency)}">
							{daysLabel(s, stream)}
						</span>
						<span class="text-ink-tertiary text-[10px] tabular-nums leading-none">
							·{targetFor(stream)}d
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</article>

{#if editing}
	<TaskEditDialog {task} onClose={() => (editing = false)} />
{/if}
