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

		// "Show archived" lives on the All page, not Focus.
		await page.getByRole('link', { name: 'All' }).first().click();
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

	test('create a category, assign it to a task, see Focus group it', async ({ page }) => {
		await page.goto('/settings');
		await page.getByLabel('Name').fill('House');
		await page.getByRole('button', { name: 'Add category' }).click();
		await expect(page.locator('article', { hasText: 'House' })).toBeVisible();

		// Create a todo and pick the new category.
		await page.goto('/');
		await page.getByRole('button', { name: 'New task' }).first().click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'New task' });
		await dialog.getByLabel('Title').fill('Vacuum');
		await dialog.getByLabel('Category').selectOption({ label: 'House' });
		await dialog.getByRole('button', { name: 'Add task' }).click();

		// Focus screen shows the House group header and the task under it.
		await expect(page.getByRole('heading', { name: 'House' })).toBeVisible();
		await expect(page.locator('article', { hasText: 'Vacuum' })).toBeVisible();
	});

	test('friends category and friend task with paired streams', async ({ page }) => {
		// Create a friends-kind category with custom defaults.
		await page.goto('/settings');
		await page.getByRole('button', { name: 'friends', exact: true }).click();
		await page.getByLabel('Name').fill('Close friends');
		await page.getByLabel('Default contacted (days)').fill('7');
		await page.getByLabel('Default seen (days)').fill('30');
		await page.getByRole('button', { name: 'Add category' }).click();
		await expect(page.locator('article', { hasText: 'Close friends' })).toBeVisible();

		// Create a friend in that category — defaults should prefill.
		await page.goto('/');
		await page.getByRole('button', { name: 'New task' }).first().click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'New task' });
		await dialog.getByRole('button', { name: 'friend', exact: true }).click();
		await dialog.getByLabel('Name').fill('Alex');
		await dialog.getByLabel('Category').selectOption({ label: 'Close friends' });
		// Prefilled from category defaults.
		await expect(dialog.getByLabel('Contacted (days)')).toHaveValue('7');
		await expect(dialog.getByLabel('Seen (days)')).toHaveValue('30');
		await dialog.getByRole('button', { name: 'Add friend' }).click();

		// Friend card shows both streams.
		const card = page.locator('article', { hasText: 'Alex' });
		await expect(card).toBeVisible();
		// "Contacted" / "Seen" appear as both stream labels (span) and buttons —
		// disambiguate by locating the span specifically.
		await expect(card.locator('span', { hasText: /^Contacted$/ })).toBeVisible();
		await expect(card.locator('span', { hasText: /^Seen$/ })).toBeVisible();

		// Logging contacted creates a per-stream completion; the contacted row
		// flips out of overdue, the seen row stays.
		await card.getByRole('button', { name: 'Contacted', exact: true }).click();
		await expect(card.getByRole('button', { name: 'Undo contacted' })).toBeVisible();
		await expect(card.getByRole('button', { name: 'Undo seen' })).toHaveCount(0);
	});
});
