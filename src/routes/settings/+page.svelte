<script lang="ts">
	import { categoryStore, reloadCategories } from '$lib/store.svelte';
	import {
		createCategory,
		updateCategory,
		deleteCategory,
		reorderCategory,
		CATEGORY_COLORS,
		DEFAULT_CATEGORY_COLOR,
		DEFAULT_FRIEND_CONTACTED_DAYS,
		DEFAULT_FRIEND_SEEN_DAYS
	} from '$lib/categories';
	import type { CategoryKind } from '$lib/types';
	import { Button, Card } from '$lib/ui';

	let newName = $state('');
	let newColor: string = $state(DEFAULT_CATEGORY_COLOR);
	let newKind: CategoryKind = $state('general');
	let newContacted: number = $state(DEFAULT_FRIEND_CONTACTED_DAYS);
	let newSeen: number = $state(DEFAULT_FRIEND_SEEN_DAYS);
	let creating = $state(false);

	let editingId: string | null = $state(null);
	let editName = $state('');
	let editColor: string = $state(DEFAULT_CATEGORY_COLOR);
	let editContacted: number = $state(DEFAULT_FRIEND_CONTACTED_DAYS);
	let editSeen: number = $state(DEFAULT_FRIEND_SEEN_DAYS);
	let editingKind: CategoryKind = $state('general');

	async function create(e: Event) {
		e.preventDefault();
		const name = newName.trim();
		if (!name) return;
		creating = true;
		try {
			await createCategory({
				name,
				color: newColor,
				kind: newKind,
				...(newKind === 'friends'
					? { defaultContactedDays: newContacted, defaultSeenDays: newSeen }
					: {})
			});
			newName = '';
			newColor = DEFAULT_CATEGORY_COLOR;
			newKind = 'general';
			newContacted = DEFAULT_FRIEND_CONTACTED_DAYS;
			newSeen = DEFAULT_FRIEND_SEEN_DAYS;
			await reloadCategories();
		} finally {
			creating = false;
		}
	}

	function startEdit(
		id: string,
		name: string,
		color: string,
		kind: CategoryKind,
		contacted?: number,
		seen?: number
	) {
		editingId = id;
		editName = name;
		editColor = color;
		editingKind = kind;
		editContacted = contacted ?? DEFAULT_FRIEND_CONTACTED_DAYS;
		editSeen = seen ?? DEFAULT_FRIEND_SEEN_DAYS;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit() {
		if (!editingId) return;
		const name = editName.trim();
		if (!name) return;
		await updateCategory(editingId, {
			name,
			color: editColor,
			...(editingKind === 'friends'
				? { defaultContactedDays: editContacted, defaultSeenDays: editSeen }
				: {})
		});
		editingId = null;
		await reloadCategories();
	}

	async function remove(id: string, name: string) {
		if (!confirm(`Delete category "${name}"? Tasks in it become uncategorized.`)) return;
		await deleteCategory(id);
		await reloadCategories();
	}

	async function move(id: string, direction: 'up' | 'down') {
		await reorderCategory(id, direction);
		await reloadCategories();
	}

	const inputClass =
		'rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
	const labelClass = 'text-ink-secondary text-xs font-medium';
</script>

{#snippet kindToggle(value: CategoryKind, set: (v: CategoryKind) => void, disabled: boolean = false)}
	<div class="bg-sunken/60 inline-flex gap-1 self-start rounded-full p-1">
		{#each ['general', 'friends'] as const as k (k)}
			<button
				type="button"
				onclick={() => set(k)}
				disabled={disabled && value !== k}
				class="rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors"
				class:bg-elevated={value === k}
				class:text-ink={value === k}
				class:shadow-paper={value === k}
				class:text-ink-tertiary={value !== k}
				class:hover:text-ink={value !== k && !disabled}
				class:opacity-50={disabled && value !== k}
				class:cursor-not-allowed={disabled && value !== k}
			>
				{k}
			</button>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-5">
	<section class="flex flex-col gap-3">
		<h2
			class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em] px-1"
		>
			Categories
		</h2>

		<Card padding="md">
			<form onsubmit={create} class="flex flex-col gap-3">
				<div class="flex flex-col gap-1.5">
					<span class={labelClass}>Type</span>
					{@render kindToggle(newKind, (v) => (newKind = v))}
				</div>

				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Name</span>
					<input
						type="text"
						bind:value={newName}
						placeholder={newKind === 'friends' ? 'e.g. Close friends, Family' : 'e.g. House, Gaming, Hobby'}
						class={inputClass}
						required
					/>
				</label>

				<div class="flex flex-col gap-1.5">
					<span class={labelClass}>Color</span>
					<div class="flex flex-wrap gap-2">
						{#each CATEGORY_COLORS as swatch (swatch.name)}
							{@const selected = newColor === swatch.value}
							<button
								type="button"
								onclick={() => (newColor = swatch.value)}
								aria-label={swatch.name}
								aria-pressed={selected}
								class="border-border-subtle h-7 w-7 rounded-full border transition-transform"
								class:ring-2={selected}
								class:ring-accent={selected}
								class:ring-offset-2={selected}
								class:ring-offset-canvas={selected}
								style:background-color={swatch.value}
							></button>
						{/each}
					</div>
				</div>

				{#if newKind === 'friends'}
					<div class="grid grid-cols-2 gap-3">
						<label class="flex flex-col gap-1.5">
							<span class={labelClass}>Default contacted (days)</span>
							<input
								type="number"
								min="1"
								bind:value={newContacted}
								class={inputClass}
								required
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class={labelClass}>Default seen (days)</span>
							<input
								type="number"
								min="1"
								bind:value={newSeen}
								class={inputClass}
								required
							/>
						</label>
					</div>
				{/if}

				<Button type="submit" disabled={creating} fullWidth>Add category</Button>
			</form>
		</Card>

		{#if categoryStore.items.length === 0}
			<p class="text-ink-tertiary px-1 text-sm">No categories yet.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each categoryStore.items as cat, idx (cat.id)}
					<Card padding="sm">
						{#if editingId === cat.id}
							<div class="flex flex-col gap-2.5">
								<!-- Kind locked while editing: existing friend tasks reference
								     this category's shape; flipping to/from friends mid-life is
								     surprising. Create a new category if a different kind is needed. -->
								{@render kindToggle(editingKind, () => {}, true)}
								<input
									type="text"
									bind:value={editName}
									class={inputClass}
								/>
								<div class="flex flex-wrap gap-2">
									{#each CATEGORY_COLORS as swatch (swatch.name)}
										{@const selected = editColor === swatch.value}
										<button
											type="button"
											onclick={() => (editColor = swatch.value)}
											aria-label={swatch.name}
											aria-pressed={selected}
											class="border-border-subtle h-6 w-6 rounded-full border"
											class:ring-2={selected}
											class:ring-accent={selected}
											class:ring-offset-2={selected}
											class:ring-offset-canvas={selected}
											style:background-color={swatch.value}
										></button>
									{/each}
								</div>
								{#if editingKind === 'friends'}
									<div class="grid grid-cols-2 gap-3">
										<label class="flex flex-col gap-1.5">
											<span class={labelClass}>Default contacted (days)</span>
											<input type="number" min="1" bind:value={editContacted} class={inputClass} required />
										</label>
										<label class="flex flex-col gap-1.5">
											<span class={labelClass}>Default seen (days)</span>
											<input type="number" min="1" bind:value={editSeen} class={inputClass} required />
										</label>
									</div>
								{/if}
								<div class="flex gap-2">
									<Button variant="secondary" size="sm" onclick={cancelEdit}>Cancel</Button>
									<Button size="sm" onclick={saveEdit}>Save</Button>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-3">
								<span
									class="border-border-subtle h-4 w-4 shrink-0 rounded-full border"
									style:background-color={cat.color}
									aria-hidden="true"
								></span>
								<span class="text-ink flex-1 truncate text-sm font-medium">
									{cat.name}
									{#if cat.kind === 'friends'}
										<span class="text-ink-tertiary ml-1.5 text-[11px] font-normal">
											· friends · {cat.defaultContactedDays}d / {cat.defaultSeenDays}d
										</span>
									{/if}
								</span>
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => move(cat.id, 'up')}
										disabled={idx === 0}
										aria-label="Move up"
										class="text-ink-tertiary hover:text-ink rounded-md p-1 transition-colors disabled:opacity-30"
									>
										<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M18 15l-6-6-6 6" />
										</svg>
									</button>
									<button
										type="button"
										onclick={() => move(cat.id, 'down')}
										disabled={idx === categoryStore.items.length - 1}
										aria-label="Move down"
										class="text-ink-tertiary hover:text-ink rounded-md p-1 transition-colors disabled:opacity-30"
									>
										<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M6 9l6 6 6-6" />
										</svg>
									</button>
									<Button
										variant="ghost"
										size="sm"
										onclick={() => startEdit(cat.id, cat.name, cat.color, cat.kind, cat.defaultContactedDays, cat.defaultSeenDays)}
									>
										Edit
									</Button>
									<Button
										variant="danger"
										size="sm"
										onclick={() => remove(cat.id, cat.name)}
									>
										Delete
									</Button>
								</div>
							</div>
						{/if}
					</Card>
				{/each}
			</div>
		{/if}
	</section>
</div>
