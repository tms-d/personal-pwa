<script lang="ts">
	import type { Task, TaskKind, Period } from '$lib/types';
	import { updateTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';

	interface Props {
		task: Task;
		onClose: () => void;
	}

	let { task, onClose }: Props = $props();

	// Snapshot the task once; the dialog is remounted per edit so the prop
	// never changes during this instance's lifetime.
	// svelte-ignore state_referenced_locally
	const initial = task;

	let dialogEl: HTMLDialogElement;
	let title = $state(initial.title);
	let notes = $state(initial.notes ?? '');
	let kind: TaskKind = $state(initial.kind);
	let period: Period = $state(initial.recurrence?.period ?? 'week');
	let dueOn: string = $state(
		initial.recurrence?.dueOn !== undefined ? String(initial.recurrence.dueOn) : ''
	);
	let targetIntervalDays = $state(initial.cadence?.targetIntervalDays ?? 7);
	let archived = $state(!!initial.archivedAt);
	let saving = $state(false);

	$effect(() => {
		if (dialogEl && !dialogEl.open) dialogEl.showModal();
	});

	async function save(e: Event) {
		e.preventDefault();
		if (!title.trim()) return;
		saving = true;
		try {
			const patch: Partial<Task> = {
				title: title.trim(),
				notes: notes.trim() || undefined,
				kind,
				archivedAt: archived
					? (task.archivedAt ?? new Date().toISOString())
					: undefined,
				recurrence: undefined,
				cadence: undefined
			};
			if (kind === 'recurring') {
				patch.recurrence = {
					period,
					...(dueOn ? { dueOn: dueOn === 'end' ? 'end' : Number(dueOn) } : {})
				};
			} else if (kind === 'cadence') {
				patch.cadence = { targetIntervalDays };
			}
			await updateTask(task.id, patch);
			await reloadTasks();
			onClose();
		} finally {
			saving = false;
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={onClose}
	class="m-auto rounded-lg border border-stone-200 bg-white p-0 shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-sm"
>
	<form onsubmit={save} class="flex w-[90vw] max-w-md flex-col gap-3 p-5">
		<h2 class="text-base font-medium">Edit task</h2>

		<div class="flex gap-2">
			{#each ['todo', 'recurring', 'cadence'] as const as k (k)}
				<button
					type="button"
					onclick={() => (kind = k)}
					class="rounded-md px-3 py-1.5 text-xs font-medium capitalize ring-1 transition-colors"
					class:bg-stone-900={kind === k}
					class:text-white={kind === k}
					class:ring-stone-900={kind === k}
					class:bg-white={kind !== k}
					class:text-stone-700={kind !== k}
					class:ring-stone-300={kind !== k}
				>
					{k}
				</button>
			{/each}
		</div>

		<label class="flex flex-col gap-1">
			<span class="text-stone-700 text-xs font-medium">Title</span>
			<input
				type="text"
				bind:value={title}
				required
				class="rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</label>

		<label class="flex flex-col gap-1">
			<span class="text-stone-700 text-xs font-medium">Notes</span>
			<input
				type="text"
				bind:value={notes}
				class="rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
		</label>

		{#if kind === 'recurring'}
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1">
					<span class="text-stone-700 text-xs font-medium">Repeats every</span>
					<select
						bind:value={period}
						class="rounded-md border border-stone-300 px-3 py-2 text-sm"
					>
						<option value="day">day</option>
						<option value="week">week</option>
						<option value="month">month</option>
						<option value="year">year</option>
					</select>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-stone-700 text-xs font-medium">Due on (optional)</span>
					<input
						type="text"
						bind:value={dueOn}
						placeholder={period === 'week' ? 'weekday 0–6' : 'day or "end"'}
						class="rounded-md border border-stone-300 px-3 py-2 text-sm"
					/>
				</label>
			</div>
		{/if}

		{#if kind === 'cadence'}
			<label class="flex flex-col gap-1">
				<span class="text-stone-700 text-xs font-medium">Target interval (days)</span>
				<input
					type="number"
					min="1"
					bind:value={targetIntervalDays}
					class="rounded-md border border-stone-300 px-3 py-2 text-sm"
				/>
			</label>
		{/if}

		<label class="flex items-center gap-2 pt-1">
			<input type="checkbox" bind:checked={archived} class="h-4 w-4" />
			<span class="text-sm text-stone-700">Archived (hidden from Today and All)</span>
		</label>

		<div class="mt-2 flex gap-2">
			<button
				type="button"
				onclick={onClose}
				class="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={saving}
				class="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</form>
</dialog>
