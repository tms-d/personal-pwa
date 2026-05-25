<script lang="ts">
	import type { TaskKind, Period, Task } from '$lib/types';
	import { createTask, WEEKDAYS } from '$lib/tasks';
	import { reloadTasks, categoryStore } from '$lib/store.svelte';
	import { Button } from '$lib/ui';
	import CategoryPicker from './CategoryPicker.svelte';
	import {
		DEFAULT_FRIEND_CONTACTED_DAYS,
		DEFAULT_FRIEND_SEEN_DAYS
	} from '$lib/categories';

	interface Props {
		onCreated?: () => void;
		initialKind?: TaskKind;
	}

	let { onCreated, initialKind = 'todo' }: Props = $props();

	// Seed once on mount; subsequent prop changes are intentionally ignored so
	// the user's in-progress kind choice survives parent re-renders.
	// svelte-ignore state_referenced_locally
	let kind: TaskKind = $state(initialKind);
	let title: string = $state('');
	let notes: string = $state('');
	let categoryId: string | undefined = $state(undefined);
	let period: Period = $state('week');
	let dueOn: string = $state('');
	let targetIntervalDays: number = $state(7);
	let contactedTargetDays: number = $state(DEFAULT_FRIEND_CONTACTED_DAYS);
	let seenTargetDays: number = $state(DEFAULT_FRIEND_SEEN_DAYS);
	let userTouchedContacted = $state(false);
	let userTouchedSeen = $state(false);
	let submitting = $state(false);

	// When the user picks a friends-kind category, prefill the target-days
	// inputs from the category's defaults — but only if the user hasn't
	// already typed a value (don't clobber a deliberate override).
	$effect(() => {
		const cat = categoryId
			? categoryStore.items.find((c) => c.id === categoryId)
			: undefined;
		if (cat?.kind === 'friends') {
			if (!userTouchedContacted && cat.defaultContactedDays !== undefined) {
				contactedTargetDays = cat.defaultContactedDays;
			}
			if (!userTouchedSeen && cat.defaultSeenDays !== undefined) {
				seenTargetDays = cat.defaultSeenDays;
			}
		}
	});

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
			} else if (kind === 'friend') {
				base.contactedTargetDays = contactedTargetDays;
				base.seenTargetDays = seenTargetDays;
			}
			await createTask(base);
			title = '';
			notes = '';
			userTouchedContacted = false;
			userTouchedSeen = false;
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
		<input
			type="text"
			bind:value={title}
			placeholder={kind === 'friend' ? "Friend's name" : 'What needs doing?'}
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
				{#if period === 'week'}
					<select bind:value={dueOn} class={inputClass}>
						<option value="">any day</option>
						{#each WEEKDAYS as name, i (i)}
							<option value={String(i)}>{name}</option>
						{/each}
					</select>
				{:else}
					<input
						type="text"
						bind:value={dueOn}
						placeholder={'day or "end"'}
						class={inputClass}
					/>
				{/if}
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

	{#if kind === 'friend'}
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1.5">
				<span class={labelClass}>Contacted (days)</span>
				<input
					type="number"
					min="1"
					bind:value={contactedTargetDays}
					oninput={() => (userTouchedContacted = true)}
					class={inputClass}
					required
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class={labelClass}>Seen (days)</span>
				<input
					type="number"
					min="1"
					bind:value={seenTargetDays}
					oninput={() => (userTouchedSeen = true)}
					class={inputClass}
					required
				/>
			</label>
		</div>
	{/if}

	<Button type="submit" disabled={submitting} fullWidth>
		{kind === 'friend' ? 'Add friend' : 'Add task'}
	</Button>
</form>
