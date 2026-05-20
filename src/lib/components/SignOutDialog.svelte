<script lang="ts">
	import { signOut } from '$lib/auth.svelte';
	import { clearLocalData } from '$lib/sync.svelte';
	import { Button } from '$lib/ui';

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
	class="border-border-subtle bg-elevated text-ink w-[90vw] max-w-md rounded-2xl border p-6 shadow-[var(--shadow-paper-overlay)] backdrop:bg-black/30 backdrop:backdrop-blur-sm"
>
	<h2 class="text-base font-medium">Sign out?</h2>
	<p class="text-ink-secondary mt-2 text-sm leading-relaxed">
		This will sign you out and clear all tasks from this device. Your data stays
		safe in the cloud — sign back in to restore everything.
	</p>
	<div class="mt-6 flex justify-end gap-2">
		<Button variant="ghost" onclick={cancel} disabled={busy}>Cancel</Button>
		<Button onclick={confirm} disabled={busy}>
			{busy ? 'Signing out…' : 'Sign out'}
		</Button>
	</div>
</dialog>
