<script lang="ts">
	import { categoryStore, reloadCategories } from '$lib/store.svelte';
	import {
		createCategory,
		updateCategory,
		deleteCategory,
		reorderCategory,
		CATEGORY_COLORS,
		DEFAULT_CATEGORY_COLOR
	} from '$lib/categories';
	import { Button, Card } from '$lib/ui';

	let newName = $state('');
	let newColor: string = $state(DEFAULT_CATEGORY_COLOR);
	let creating = $state(false);

	let editingId: string | null = $state(null);
	let editName = $state('');
	let editColor: string = $state(DEFAULT_CATEGORY_COLOR);

	async function create(e: Event) {
		e.preventDefault();
		const name = newName.trim();
		if (!name) return;
		creating = true;
		try {
			await createCategory({ name, color: newColor });
			newName = '';
			newColor = DEFAULT_CATEGORY_COLOR;
			await reloadCategories();
		} finally {
			creating = false;
		}
	}

	function startEdit(id: string, name: string, color: string) {
		editingId = id;
		editName = name;
		editColor = color;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit() {
		if (!editingId) return;
		const name = editName.trim();
		if (!name) return;
		await updateCategory(editingId, { name, color: editColor });
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

<div class="flex flex-col gap-5">
	<section class="flex flex-col gap-3">
		<h2
			class="text-ink-tertiary text-[11px] font-medium uppercase tracking-[0.15em] px-1"
		>
			Categories
		</h2>

		<Card padding="md">
			<form onsubmit={create} class="flex flex-col gap-3">
				<label class="flex flex-col gap-1.5">
					<span class={labelClass}>Name</span>
					<input
						type="text"
						bind:value={newName}
						placeholder="e.g. House, Gaming, Hobby"
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
										onclick={() => startEdit(cat.id, cat.name, cat.color)}
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
