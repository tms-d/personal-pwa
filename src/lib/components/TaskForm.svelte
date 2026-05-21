<script lang="ts">
	import type { TaskKind, Period, Task } from '$lib/types';
	import { createTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';
	import { Button } from '$lib/ui';
	import CategoryPicker from './CategoryPicker.svelte';

	interface Props {
		onCreated?: () => void;
	}

	let { onCreated }: Props = $props();

	let kind: TaskKind = $state('todo');
	let title: string = $state('');
	let notes: string = $state('');
	let categoryId: string | undefined = $state(undefined);
	let period: Period = $state('week');
	let dueOn: string = $state('');
	let targetIntervalDays: number = $state(7);
	let submitting = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		if (!title.trim()) return;
		submitting = true;
		try {
			const base: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
				title: title.trim(),
				notes: notes.trim() || undefined,
				kind,
				categoryId: categoryId || undefined
			};
			if (kind === 'recurring') {
				base.recurrence = {
					period,
					...(dueOn ? { dueOn: dueOn === 'end' ? 'end' : Number(dueOn) } : {})
				};
			} else if (kind === 'cadence') {
				base.cadence = { targetIntervalDays };
			}
			await createTask(base);
			title = '';
			notes = '';
			await reloadTasks();
			onCreated?.();
		} finally {
			submitting = false;
		}
	}

	const inputClass =
		'rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

	const labelClass = 'text-ink-secondary text-xs font-medium';
</script>

<form onsubmit={submit} class="flex flex-col gap-4">
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
		<input
			type="text"
			bind:value={title}
			placeholder="What needs doing?"
			required
			class={inputClass}
		/>
	</label>

	<label class="flex flex-col gap-1.5">
		<span class={labelClass}>Notes (optional)</span>
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

	<Button type="submit" disabled={submitting} fullWidth>Add task</Button>
</form>

