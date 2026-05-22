<script lang="ts">
	import { Button } from '$lib/ui';
	import { submitBugReport } from '$lib/bug-report';

	interface Props {
		open: boolean;
		// The screenshot is taken *before* this dialog opens (otherwise the
		// dialog itself ends up in the screenshot). Parent passes it in.
		screenshot: Blob | null;
		onClose: () => void;
	}

	let { open = $bindable(false), screenshot, onClose }: Props = $props();

	let dialog: HTMLDialogElement | null = $state(null);
	let description = $state('');
	let includeScreenshot = $state(true);
	let phase = $state<'idle' | 'submitting' | 'success' | 'error'>('idle');
	let resultUrl = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const previewUrl = $derived(screenshot ? URL.createObjectURL(screenshot) : null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Revoke object URL when the dialog closes / screenshot changes.
	$effect(() => {
		const url = previewUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	function close() {
		// Reset for the next open.
		description = '';
		includeScreenshot = true;
		phase = 'idle';
		resultUrl = null;
		errorMessage = null;
		open = false;
		onClose();
	}

	async function submit() {
		const text = description.trim();
		if (!text) return;
		phase = 'submitting';
		errorMessage = null;
		try {
			const res = await submitBugReport({
				description: text,
				screenshot: includeScreenshot ? screenshot : null
			});
			resultUrl = res.issueUrl;
			phase = 'success';
		} catch (e) {
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: String(e);
			errorMessage = msg;
			phase = 'error';
		}
	}

	const inputClass =
		'rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
</script>

<dialog
	bind:this={dialog}
	onclose={close}
	data-no-screenshot
	class="border-border-subtle bg-elevated text-ink m-auto w-[90vw] max-w-md rounded-2xl border p-0 shadow-[var(--shadow-paper-overlay)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
>
	<div class="flex flex-col gap-4 p-5">
		{#if phase === 'success'}
			<h2 class="text-base font-medium">Thanks — bug filed</h2>
			<p class="text-ink-secondary text-sm leading-relaxed">
				Your report is now on GitHub. I'll take a look.
			</p>
			{#if resultUrl}
				<a
					href={resultUrl}
					target="_blank"
					rel="noopener"
					class="text-accent hover:text-accent-hover text-sm underline-offset-2 hover:underline break-all"
				>
					{resultUrl}
				</a>
			{/if}
			<div class="mt-2 flex justify-end">
				<Button onclick={close}>Done</Button>
			</div>
		{:else}
			<h2 class="text-base font-medium">Report a bug</h2>
			<p class="text-ink-secondary text-sm leading-relaxed">
				Tell me what went wrong. Your screenshot, the page URL, and your browser
				info will be attached to the issue.
			</p>

			<label class="flex flex-col gap-1.5">
				<span class="text-ink-secondary text-xs font-medium">What happened?</span>
				<textarea
					bind:value={description}
					rows="5"
					placeholder="Describe the issue. What did you do? What did you expect?"
					class="{inputClass} resize-y"
					disabled={phase === 'submitting'}
				></textarea>
			</label>

			{#if previewUrl}
				<label class="flex items-start gap-2.5">
					<input
						type="checkbox"
						bind:checked={includeScreenshot}
						class="mt-1 accent-accent"
						disabled={phase === 'submitting'}
					/>
					<span class="flex-1">
						<span class="text-ink-secondary text-xs font-medium">Include screenshot</span>
						<img
							src={previewUrl}
							alt="Screenshot preview"
							class="border-border-subtle mt-2 max-h-48 w-full rounded-lg border object-contain"
							class:opacity-50={!includeScreenshot}
						/>
					</span>
				</label>
			{:else}
				<p class="text-ink-tertiary text-xs">
					Couldn't capture a screenshot — the report will go through without one.
				</p>
			{/if}

			{#if phase === 'error' && errorMessage}
				<p class="text-danger text-xs">Couldn't file the issue: {errorMessage}</p>
			{/if}

			<div class="mt-2 flex justify-end gap-2">
				<Button variant="ghost" onclick={close} disabled={phase === 'submitting'}>
					Cancel
				</Button>
				<Button
					onclick={submit}
					disabled={phase === 'submitting' || !description.trim()}
				>
					{phase === 'submitting' ? 'Sending…' : 'Send'}
				</Button>
			</div>
		{/if}
	</div>
</dialog>
