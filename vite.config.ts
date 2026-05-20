import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Inline PUBLIC_* via import.meta.env at build time. Required for
	// adapter-static SPAs: $env/dynamic/public ships empty when there's
	// no SSR pass to populate it.
	envPrefix: ['VITE_', 'PUBLIC_'],
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.ts'],
		globals: true
	}
});
