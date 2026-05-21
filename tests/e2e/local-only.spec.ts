import { test, expect, type Page } from '@playwright/test';

// Layer 3: UI flows that don't depend on auth or Supabase. Runs against a
// fresh browser context each test, so IndexedDB starts empty.

async function addTodo(page: Page, title: string) {
	await page.goto('/');
	await page.getByRole('button', { name: 'New task' }).first().click();
	const dialog = page.getByRole('dialog').filter({ hasText: 'New task' });
	await dialog.getByLabel('Title').fill(title);
	await dialog.getByRole('button', { name: 'Add task' }).click();
	await expect(page.locator('article', { hasText: title })).toBeVisible();
}

test.describe('Local-only task flows', () => {
	test('create a todo and see it on Focus', async ({ page }) => {
		await addTodo(page, 'Test todo');
		await page.getByRole('link', { name: 'Focus' }).first().click();
		await expect(page.locator('article', { hasText: 'Test todo' })).toBeVisible();
	});

	test('complete a task moves it off Focus', async ({ page }) => {
		await addTodo(page, 'Done soon');
		await page.getByRole('link', { name: 'Focus' }).first().click();
		const card = page.locator('article', { hasText: 'Done soon' });
		await card.getByRole('button', { name: 'Mark done' }).click();
		await expect(page.locator('article', { hasText: 'Done soon' })).toHaveCount(0);
	});

	test('edit a task title persists on reload', async ({ page }) => {
		await addTodo(page, 'Original');
		const card = page.locator('article', { hasText: 'Original' });
		await card.getByRole('button', { name: 'Edit' }).click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Title').fill('Renamed');
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(page.locator('article', { hasText: 'Renamed' })).toBeVisible();
		await page.reload();
		await expect(page.locator('article', { hasText: 'Renamed' })).toBeVisible();
		await expect(page.locator('article', { hasText: 'Original' })).toHaveCount(0);
	});

	test('archive hides task; show archived toggle reveals it', async ({ page }) => {
		await addTodo(page, 'Will be archived');
		const card = page.locator('article', { hasText: 'Will be archived' });
		await card.getByRole('button', { name: 'Edit' }).click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel(/Archived/).check();
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(page.locator('article', { hasText: 'Will be archived' })).toHaveCount(0);
		await page.getByLabel(/Show archived/).check();
		await expect(page.locator('article', { hasText: 'Will be archived' })).toBeVisible();
	});

	test('navigation between tabs works', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'All' }).first().click();
		await expect(page).toHaveURL(/\/all/);

		// History lives in the account menu now
		await page.getByRole('button', { name: 'Account' }).first().click();
		await page.getByRole('link', { name: 'History' }).click();
		await expect(page).toHaveURL(/\/history/);

		await page.getByRole('link', { name: 'Focus' }).first().click();
		await expect(page).toHaveURL(/\/$/);
	});

	test('account menu shows "Sign in with GitHub" when not signed in', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Account' }).first().click();
		await expect(page.getByRole('button', { name: /Sign in with GitHub/ })).toBeVisible();
	});
});
