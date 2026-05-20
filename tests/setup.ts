import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

if (typeof globalThis.structuredClone !== 'function') {
	globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

beforeEach(async () => {
	const { db } = await import('$lib/db');
	await Promise.all([db.tasks.clear(), db.completions.clear(), db.outbox.clear()]);
});
