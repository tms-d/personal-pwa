<script lang="ts">
	import TaskForm from './TaskForm.svelte';
	import type { TaskKind } from '$lib/types';

	interface Props {
		open: boolean;
		initialKind?: TaskKind;
	}

	let { open = $bindable(), initialKind = 'todo' }: Props = $props();
	let dialogEl: HTMLDialogElement;

	const heading = $derived(initialKind === 'friend' ? 'New friend' : 'New task');

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	function close() {
		open = false;
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={() => (open = false)}
	class="task-sheet border-border-subtle bg-elevated text-ink border p-0 shadow-[var(--shadow-paper-overlay)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
>
	<div class="task-sheet-body flex flex-col gap-3 p-5">
		<div class="flex items-center justify-between">
			<h2 class="text-base font-medium">{heading}</h2>
			<button
				type="button"
				onclick={close}
				aria-label="Close"
				class="text-ink-tertiary hover:text-ink -mr-1 rounded-md p-1 transition-colors"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</div>
		{#if open}
			<TaskForm onCreated={close} {initialKind} />
		{/if}
	</div>
</dialog>

<style>
	/* Desktop: centered modal */
	dialog.task-sheet {
		margin: auto;
		border-radius: 1rem;
		width: min(90vw, 32rem);
	}

	/* Mobile: bottom sheet */
	@media (max-width: 767px) {
		dialog.task-sheet {
			width: 100%;
			max-width: 100%;
			margin: 0;
			margin-top: auto;
			border-radius: 1.25rem 1.25rem 0 0;
			border-bottom: none;
			inset-block: auto 0;
		}
		dialog.task-sheet .task-sheet-body {
			padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
		}
	}
</style>
