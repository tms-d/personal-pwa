<script lang="ts">
	import { signInWithGitHub } from '$lib/auth.svelte';

	let signing = $state(false);

	async function go() {
		signing = true;
		try {
			await signInWithGitHub();
		} finally {
			signing = false;
		}
	}
</script>

<div class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
	<h2 class="text-base font-medium">Sync across devices</h2>
	<p class="text-stone-500 mt-1 text-sm">
		Sign in with GitHub to back up and sync your tasks. The app keeps working without
		signing in — your data lives in this browser.
	</p>
	<button
		type="button"
		onclick={go}
		disabled={signing}
		class="mt-4 inline-flex items-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
	>
		<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
			<path
				d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.96c-3.2.7-3.87-1.54-3.87-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.19a11 11 0 0 1 5.79 0c2.21-1.5 3.18-1.19 3.18-1.19.62 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.79.56 4.57-1.52 7.86-5.83 7.86-10.91C23.5 5.65 18.35.5 12 .5Z"
			/>
		</svg>
		{signing ? 'Redirecting…' : 'Sign in with GitHub'}
	</button>
</div>
