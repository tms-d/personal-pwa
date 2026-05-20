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
	// Opt-in: when DEV_TUNNEL=1, bind the dev server to all interfaces and
	// accept any host header so a Cloudflare quick-tunnel can proxy to it.
	server: process.env.DEV_TUNNEL
		? { host: '0.0.0.0', allowedHosts: true }
		: undefined,
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.ts'],
		globals: true
	}
});
