<script lang="ts">
	import type { Task, TaskKind, Period } from '$lib/types';
	import { updateTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';
	import { Button } from '$lib/ui';
	import CategoryPicker from './CategoryPicker.svelte';

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
	let categoryId: string | undefined = $state(initial.categoryId);
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
				categoryId: categoryId || undefined,
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

	const inputClass =
		'rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

	const labelClass = 'text-ink-secondary text-xs font-medium';
</script>

<dialog
	bind:this={dialogEl}
	onclose={onClose}
	class="border-border-subtle bg-elevated text-ink m-auto rounded-2xl border p-0 shadow-[var(--shadow-paper-overlay)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
>
	<form onsubmit={save} class="flex w-[90vw] max-w-md flex-col gap-4 p-5">
		<h2 class="text-base font-medium">Edit task</h2>

		<div class="bg-sunken/60 inline-flex gap-1 self-start rounded-full p-1">
			{#each ['todo', 'recurring', 'cadence'] as const as k (k)}
				<button
					type="button"
					onclick={() => (kind = k)}
					class="rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors"
					class:bg-elevated={kind === k}
					class:text-ink={kind === k}
					class:shadow-paper={kind === k}
					class:text-ink-tertiary={kind !== k}
					class:hover:text-ink={kind !== k}
				>
					{k}
				</button>
			{/each}
		</div>

		<label class="flex flex-col gap-1.5">
			<span class={labelClass}>Title</span>
			<input type="text" bind:value={title} required class={inputClass} />
		</label>

		<label class="flex flex-col gap-1.5">
			<span class={labelClass}>Notes</span>
			<input type="text" bind:value={notes} class={inputClass} />
		</label>

		<CategoryPicker bind:value={categoryId} />

		{#if kind === 'recurring'}
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Repeats every</span>
					<select bind:value={period} class={inputClass}>
						<option value="day">day</option>
						<option value="week">week</option>
						<option value="month">month</option>
						<option value="year">year</option>
					</select>
				</label>
				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Due on (optional)</span>
					<input
						type="text"
						bind:value={dueOn}
						placeholder={period === 'week' ? 'weekday 0–6' : 'day or "end"'}
						class={inputClass}
					/>
				</label>
			</div>
		{/if}

		{#if kind === 'cadence'}
			<label class="flex flex-col gap-1.5">
				<span class={labelClass}>Target interval (days)</span>
				<input
					type="number"
					min="1"
					bind:value={targetIntervalDays}
					class={inputClass}
				/>
			</label>
		{/if}

		<label class="flex items-center gap-2 pt-1">
			<input
				type="checkbox"
				bind:checked={archived}
				class="accent-accent h-4 w-4"
			/>
			<span class="text-ink-secondary text-sm">
				Archived (hidden from Today and All)
			</span>
		</label>

		<div class="mt-2 flex gap-2">
			<Button variant="secondary" onclick={onClose} fullWidth>Cancel</Button>
			<Button type="submit" disabled={saving} fullWidth>
				{saving ? 'Saving…' : 'Save'}
			</Button>
		</div>
	</form>
</dialog>
