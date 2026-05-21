<script lang="ts">
	import { categoryStore } from '$lib/store.svelte';

	interface Props {
		value: string | undefined;
	}

	let { value = $bindable() }: Props = $props();

	const inputClass =
		'rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

	const selectedColor = $derived(
		categoryStore.items.find((c) => c.id === value)?.color ?? null
	);
</script>

<label class="flex flex-col gap-1.5">
	<span class="text-ink-secondary text-xs font-medium">Category</span>
	<div class="relative">
		{#if selectedColor}
			<span
				class="border-border-subtle pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border"
				style:background-color={selectedColor}
				aria-hidden="true"
			></span>
		{/if}
		<select
			bind:value
			class="{inputClass} w-full"
			class:pl-8={selectedColor}
		>
			<option value={undefined}>Uncategorized</option>
			{#each categoryStore.items as c (c.id)}
				<option value={c.id}>{c.name}</option>
			{/each}
		</select>
	</div>
</label>
