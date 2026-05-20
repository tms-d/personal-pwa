import { test, expect, type Page } from '@playwright/test';
import {
	getSyncConfig,
	seedSession,
	signedInClient,
	wipeUserRows
} from './helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

const config = getSyncConfig();

// Hook every page so any client-side error / failed network request /
// console.error surfaces in the test log. Makes failures self-diagnosing
// instead of mystery timeouts.
function instrument(page: Page, label = 'page') {
	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') {
			console.log(`[${label} ${msg.type()}]`, msg.text());
		}
	});
	page.on('pageerror', (err) => {
		console.log(`[${label} pageerror]`, err.message);
	});
	page.on('requestfailed', (req) => {
		console.log(`[${label} requestfailed]`, req.method(), req.url(), req.failure()?.errorText);
	});
}

// When a wait for the "Synced" pill is about to fail, capture what the pill
// actually shows (e.g. "Sync error · message", "Syncing…", "Local only · Sign
// in") so the failure message tells us what's wrong instead of just timing out.
async function expectSyncedOrDiagnose(page: Page, timeout = 15_000): Promise<void> {
	try {
		await expect(page.getByRole('button', { name: /synced/i })).toBeVisible({ timeout });
	} catch (e) {
		const all = await page.getByRole('button').allTextContents();
		const titles = await page.locator('button[title]').evaluateAll((els) =>
			els.map((el) => ({ text: el.textContent?.trim(), title: el.getAttribute('title') }))
		);
		const localStorageKeys = await page.evaluate(() => Object.keys(window.localStorage));
		throw new Error(
			`Sync pill never showed "Synced …". Buttons on page: ${JSON.stringify(all)}. ` +
				`With titles: ${JSON.stringify(titles)}. ` +
				`LocalStorage keys: ${JSON.stringify(localStorageKeys)}. ` +
				`Underlying error: ${e instanceof Error ? e.message : String(e)}`
		);
	}
}

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

	test.beforeEach(async ({ context, page }) => {
		if (!config) return;
		instrument(page);
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
		await client.from('tasks').insert({
			id: 'sync-test-1',
			user_id: (await client.auth.getUser()).data.user!.id,
			title: 'Seeded from server',
			kind: 'todo',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});

		await page.goto('/');
		await expectSyncedOrDiagnose(page);
		await expect(page.getByText('Seeded from server')).toBeVisible();
	});

	test('creating a task locally pushes to Supabase', async ({ page }) => {
		if (!config) return;
		await page.goto('/all');

		await page.getByLabel('Title').fill('Pushed from client');
		await page.getByRole('button', { name: 'Add task' }).click();

		await expectSyncedOrDiagnose(page);

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
		instrument(pageA, 'A');
		instrument(pageB, 'B');
		await pageA.goto('/all');
		await pageB.goto('/');

		await expectSyncedOrDiagnose(pageA);
		await expectSyncedOrDiagnose(pageB);

		await pageA.getByLabel('Title').fill('Made on device A');
		await pageA.getByRole('button', { name: 'Add task' }).click();

		await expect(pageB.locator('article', { hasText: 'Made on device A' })).toBeVisible({
			timeout: 10_000
		});

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
