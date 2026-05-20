<script lang="ts">
	import { signOut } from '$lib/auth.svelte';
	import { clearLocalData } from '$lib/sync.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let dialog: HTMLDialogElement | null = $state(null);
	let busy = $state(false);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	async function confirm() {
		busy = true;
		try {
			await signOut();
			await clearLocalData();
			open = false;
		} finally {
			busy = false;
		}
	}

	function cancel() {
		open = false;
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	class="w-[90vw] max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-lg backdrop:bg-black/30"
>
	<h2 class="text-base font-medium">Sign out?</h2>
	<p class="text-stone-500 mt-2 text-sm">
		This will sign you out and clear all tasks from this device. Your data stays safe in
		the cloud — sign back in to restore everything.
	</p>
	<div class="mt-6 flex justify-end gap-2">
		<button
			type="button"
			onclick={cancel}
			disabled={busy}
			class="text-stone-700 hover:bg-stone-100 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={confirm}
			disabled={busy}
			class="bg-stone-900 hover:bg-stone-700 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
		>
			{busy ? 'Signing out…' : 'Sign out'}
		</button>
	</div>
</dialog>
