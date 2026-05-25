<script lang="ts">
	import type { TaskWithLast, CompletionStream } from '$lib/types';
	import { computeStatus, type Urgency, type ComputedStreamStatus } from '$lib/tasks';
	import { completeTask } from '$lib/tasks';
	import { reloadTasks, categoryStore } from '$lib/store.svelte';
	import TaskEditDialog from './TaskEditDialog.svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		task: TaskWithLast;
	}

	let { task }: Props = $props();
	let editing = $state(false);
	let justStreamed = $state<CompletionStream | null>(null);

	let dragX = $state(0);
	let dragging = $state(false);
	let pointerId: number | null = $state(null);
	let startX = $state(0);
	let startY = $state(0);
	let axisLocked = $state(false);
	let axis = $state<'x' | 'y' | null>(null);
	const COMMIT_PX = 80;
	const AXIS_LOCK_PX = 8;

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

	function resetDrag() {
		dragX = 0;
		dragging = false;
		axisLocked = false;
		axis = null;
		pointerId = null;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
	}

	function onPointerMove(e: PointerEvent) {
		if (pointerId !== e.pointerId || !dragging) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!axisLocked) {
			if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
			axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
			axisLocked = true;
			if (axis === 'x') {
				(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			}
		}
		if (axis === 'x') {
			e.preventDefault();
			dragX = dx;
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (pointerId !== e.pointerId) return;
		const finalDx = dragX;
		const wasDrag = axis === 'x' && Math.abs(finalDx) > AXIS_LOCK_PX;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// not captured
		}
		resetDrag();
		if (wasDrag) {
			if (finalDx > COMMIT_PX) void logStream('contacted');
			else if (finalDx < -COMMIT_PX) void logStream('seen');
		} else {
			editing = true;
		}
	}

	function onPointerCancel() {
		resetDrag();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			editing = true;
		}
	}

	const swipeDirection = $derived(dragX > AXIS_LOCK_PX ? 'right' : dragX < -AXIS_LOCK_PX ? 'left' : null);
	const swipeProgress = $derived(Math.min(1, Math.abs(dragX) / COMMIT_PX));
</script>

<div class="relative">
	{#if swipeDirection === 'right'}
		<div
			class="bg-success-soft text-success absolute inset-0 flex items-center justify-start gap-2 rounded-2xl pl-5"
			style:opacity={swipeProgress}
			aria-hidden="true"
		>
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
			</svg>
			<span class="text-xs font-semibold uppercase tracking-wide">Contacted</span>
		</div>
	{:else if swipeDirection === 'left'}
		<div
			class="bg-success-soft text-success absolute inset-0 flex items-center justify-end gap-2 rounded-2xl pr-5"
			style:opacity={swipeProgress}
			aria-hidden="true"
		>
			<span class="text-xs font-semibold uppercase tracking-wide">Saw them</span>
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		</div>
	{/if}

	<div
		role="button"
		tabindex="0"
		aria-label="Edit {task.title}"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		onkeydown={onKeydown}
		class="shadow-paper relative flex select-none flex-col gap-3 overflow-hidden rounded-2xl border py-3.5 pl-5 pr-3.5 transition-transform {toneClass(
			status.urgency
		)}"
		class:cursor-grabbing={dragging && axis === 'x'}
		style:transform="translateX({dragX}px)"
		style:transition={dragging ? 'none' : 'transform 180ms ease-out'}
		style:touch-action="pan-y"
	>
		{#if category}
			<span
				class="absolute inset-y-0 left-0 w-[5px]"
				style:background-color={category.color}
				aria-hidden="true"
			></span>
		{/if}
		<div class="flex min-w-0 items-center gap-2">
			<span class="text-ink flex-1 truncate text-sm font-semibold leading-tight">{task.title}</span>
		</div>

		{#if status.streams}
			<div class="mt-auto flex flex-col gap-1.5">
				{#each [['contacted', status.streams.contacted], ['seen', status.streams.seen]] as const as [stream, s] (stream)}
					<div class="flex items-baseline gap-2 -mx-1 px-1 py-0.5">
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
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if editing}
	<TaskEditDialog {task} onClose={() => (editing = false)} />
{/if}
