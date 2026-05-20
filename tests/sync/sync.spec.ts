import { test, expect } from '@playwright/test';
import {
	getSyncConfig,
	seedSession,
	signedInClient,
	wipeUserRows
} from './helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

const config = getSyncConfig();

test.describe('Sync', { tag: '@sync' }, () => {
	test.skip(
		!config,
		'TEST_USER_EMAIL / TEST_USER_PASSWORD / PUBLIC_SUPABASE_* not set'
	);

	let client!: SupabaseClient;

	test.beforeAll(async () => {
		if (!config) return;
		const result = await signedInClient(config);
		client = result.client;
	});

	test.beforeEach(async ({ context }) => {
		if (!config) return;
		await wipeUserRows(client);
		const { session } = await signedInClient(config);
		await seedSession(context, config.supabaseUrl, session);
	});

	test.afterAll(async () => {
		if (!config) return;
		await wipeUserRows(client);
	});

	test('signs in via injected session and pulls remote tasks', async ({ page }) => {
		if (!config) return;
		// Seed a row server-side, then open the app — fullSync should pull it.
		await client.from('tasks').insert({
			id: 'sync-test-1',
			user_id: (await client.auth.getUser()).data.user!.id,
			title: 'Seeded from server',
			kind: 'todo',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});

		await page.goto('/');

		// SyncStatus pill should show "Synced …" once fullSync completes.
		await expect(page.getByRole('button', { name: /synced/i })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText('Seeded from server')).toBeVisible();
	});

	test('creating a task locally pushes to Supabase', async ({ page }) => {
		if (!config) return;
		await page.goto('/all');

		await page.getByLabel('Title').fill('Pushed from client');
		await page.getByRole('button', { name: 'Add task' }).click();

		// Wait for pendingCount to hit 0 — outbox drained
		await expect(page.getByRole('button', { name: /synced/i })).toBeVisible({
			timeout: 10_000
		});

		const { data } = await client.from('tasks').select('*').eq('title', 'Pushed from client');
		expect(data).not.toBeNull();
		expect(data!.length).toBe(1);
	});

	test('two contexts: realtime delivers a remote change to the second', async ({ browser }) => {
		if (!config) return;
		const ctxA = await browser.newContext();
		const ctxB = await browser.newContext();
		const { session } = await signedInClient(config);
		await seedSession(ctxA, config.supabaseUrl, session);
		await seedSession(ctxB, config.supabaseUrl, session);

		const pageA = await ctxA.newPage();
		const pageB = await ctxB.newPage();
		await pageA.goto('/');
		await pageB.goto('/');

		await expect(pageA.getByRole('button', { name: /synced/i })).toBeVisible({
			timeout: 10_000
		});
		await expect(pageB.getByRole('button', { name: /synced/i })).toBeVisible({
			timeout: 10_000
		});

		await pageA.getByLabel(/title/i).fill('Made on device A');
		await pageA.getByRole('button', { name: /add/i }).click();

		// B should see it via realtime, without reloading
		await expect(pageB.getByText('Made on device A')).toBeVisible({ timeout: 10_000 });

		await ctxA.close();
		await ctxB.close();
	});

	test('sign-out clears local data', async ({ page }) => {
		if (!config) return;
		await page.goto('/all');
		await page.getByLabel('Title').fill('Will be cleared');
		await page.getByRole('button', { name: 'Add task' }).click();
		await expect(page.locator('article', { hasText: 'Will be cleared' })).toBeVisible();

		await page.getByRole('button', { name: /sign out/i }).click();
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /sign out/i })
			.click();

		await expect(page.getByRole('button', { name: /local only.*sign in/i })).toBeVisible();
		await expect(page.locator('article', { hasText: 'Will be cleared' })).toHaveCount(0);
	});
});
