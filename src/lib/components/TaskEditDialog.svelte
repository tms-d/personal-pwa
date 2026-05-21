<script lang="ts">
	import type { TaskWithLast, Task, TaskKind, Period, CompletionStream } from '$lib/types';
	import { updateTask, deleteTask, setLastCompletedAt, uncompleteTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';
	import { Button } from '$lib/ui';
	import CategoryPicker from './CategoryPicker.svelte';

	interface Props {
		task: TaskWithLast;
		onClose: () => void;
	}

	let { task, onClose }: Props = $props();

	// Snapshot the task once; the dialog is remounted per edit so the prop
	// never changes during this instance's lifetime.
	// svelte-ignore state_referenced_locally
	const initial = task;

	function toDateInput(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	function fromDateInput(s: string): Date {
		// Parse as local-time noon to avoid timezone underflow into the previous day.
		const [y, m, d] = s.split('-').map(Number);
		return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
	}
	const todayInput = toDateInput(new Date().toISOString());

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
	let contactedTargetDays = $state(initial.contactedTargetDays ?? 14);
	let seenTargetDays = $state(initial.seenTargetDays ?? 60);

	// Date-picker state for the most-recent completion. Changes apply
	// immediately (not on Save) — they're inline edits, not form fields.
	let lastCompletedInput = $state(toDateInput(initial.lastCompletedAt));
	let lastContactedInput = $state(toDateInput(initial.lastContactedAt));
	let lastSeenInput = $state(toDateInput(initial.lastSeenAt));

	let saving = $state(false);
	let deleting = $state(false);

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
				recurrence: undefined,
				cadence: undefined,
				contactedTargetDays: undefined,
				seenTargetDays: undefined
			};
			if (kind === 'recurring') {
				patch.recurrence = {
					period,
					...(dueOn ? { dueOn: dueOn === 'end' ? 'end' : Number(dueOn) } : {})
				};
			} else if (kind === 'cadence') {
				patch.cadence = { targetIntervalDays };
			} else if (kind === 'friend') {
				patch.contactedTargetDays = contactedTargetDays;
				patch.seenTargetDays = seenTargetDays;
			}
			await updateTask(task.id, patch);
			await reloadTasks();
			onClose();
		} finally {
			saving = false;
		}
	}

	async function applyLastCompleted(input: string, stream?: CompletionStream) {
		if (!input) {
			await uncompleteTask(task.id, stream);
		} else {
			await setLastCompletedAt(task.id, fromDateInput(input), stream);
		}
		await reloadTasks();
	}

	async function remove() {
		if (!confirm(`Delete "${task.title}"?`)) return;
		deleting = true;
		try {
			await deleteTask(task.id);
			await reloadTasks();
			onClose();
		} finally {
			deleting = false;
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
		<h2 class="text-base font-medium">Edit {kind === 'friend' ? 'friend' : 'task'}</h2>

		<div class="bg-sunken/60 inline-flex gap-1 self-start rounded-full p-1">
			{#each ['todo', 'recurring', 'cadence', 'friend'] as const as k (k)}
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
			<span class={labelClass}>{kind === 'friend' ? 'Name' : 'Title'}</span>
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
			{#if initial.kind === 'cadence'}
				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Last completed on</span>
					<input
						type="date"
						bind:value={lastCompletedInput}
						max={todayInput}
						onchange={() => applyLastCompleted(lastCompletedInput)}
						class={inputClass}
					/>
				</label>
			{/if}
		{/if}

		{#if kind === 'friend'}
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Contacted (days)</span>
					<input type="number" min="1" bind:value={contactedTargetDays} class={inputClass} required />
				</label>
				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Seen (days)</span>
					<input type="number" min="1" bind:value={seenTargetDays} class={inputClass} required />
				</label>
			</div>
			{#if initial.kind === 'friend'}
				<div class="grid grid-cols-2 gap-3">
					<label class="flex flex-col gap-1.5">
						<span class={labelClass}>Last contacted on</span>
						<input
							type="date"
							bind:value={lastContactedInput}
							max={todayInput}
							onchange={() => applyLastCompleted(lastContactedInput, 'contacted')}
							class={inputClass}
						/>
					</label>
					<label class="flex flex-col gap-1.5">
						<span class={labelClass}>Last seen on</span>
						<input
							type="date"
							bind:value={lastSeenInput}
							max={todayInput}
							onchange={() => applyLastCompleted(lastSeenInput, 'seen')}
							class={inputClass}
						/>
					</label>
				</div>
			{/if}
		{/if}

		<div class="mt-2 flex gap-2">
			<Button variant="danger" onclick={remove} disabled={deleting}>Delete</Button>
			<Button variant="secondary" onclick={onClose} fullWidth>Cancel</Button>
			<Button type="submit" disabled={saving} fullWidth>
				{saving ? 'Saving…' : 'Save'}
			</Button>
		</div>
	</form>
</dialog>
