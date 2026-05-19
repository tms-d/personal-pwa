<script lang="ts">
	import type { TaskKind, Period, Task } from '$lib/types';
	import { createTask } from '$lib/tasks';
	import { reloadTasks } from '$lib/store.svelte';

	let kind: TaskKind = $state('todo');
	let title: string = $state('');
	let notes: string = $state('');
	let period: Period = $state('week');
	let dueOn: string = $state('');
	let targetIntervalDays: number = $state(7);
	let submitting = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		if (!title.trim()) return;
		submitting = true;
		try {
			const base: Omit<Task, 'id' | 'createdAt'> = {
				title: title.trim(),
				notes: notes.trim() || undefined,
				kind
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
		} finally {
			submitting = false;
		}
	}
</script>

<form
	onsubmit={submit}
	class="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
>
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
			placeholder="What needs doing?"
			required
			class="rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</label>

	<label class="flex flex-col gap-1">
		<span class="text-stone-700 text-xs font-medium">Notes (optional)</span>
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

	<button
		type="submit"
		disabled={submitting}
		class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
	>
		Add task
	</button>
</form>
