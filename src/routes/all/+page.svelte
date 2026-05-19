<script lang="ts">
	import TaskCard from '$lib/components/TaskCard.svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import { taskStore } from '$lib/store.svelte';

	const sorted = $derived(
		[...taskStore.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
	);
</script>

<div class="flex flex-col gap-4">
	<TaskForm />

	<section class="flex flex-col gap-3">
		<h2 class="text-stone-500 px-1 text-xs font-medium uppercase tracking-wide">All tasks</h2>
		{#if sorted.length === 0}
			<p class="text-stone-500 px-1 text-sm">No tasks yet.</p>
		{:else}
			{#each sorted as task (task.id)}
				<TaskCard {task} />
			{/each}
		{/if}
	</section>
</div>
