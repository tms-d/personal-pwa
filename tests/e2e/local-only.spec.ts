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
		const row = page.locator('article', { hasText: 'Done soon' });
		// Compact row: round checkbox at the front is the primary action.
		await row.getByRole('button', { name: 'Mark Done soon done' }).click();
		await expect(page.locator('article', { hasText: 'Done soon' })).toHaveCount(0);
	});

	test('edit a task title persists on reload', async ({ page }) => {
		await addTodo(page, 'Original');
		const row = page.locator('article', { hasText: 'Original' });
		// ⋯ button on the row opens the edit dialog.
		await row.getByRole('button', { name: 'Edit Original' }).click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Title').fill('Renamed');
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(page.locator('article', { hasText: 'Renamed' })).toBeVisible();
		await page.reload();
		await expect(page.locator('article', { hasText: 'Renamed' })).toBeVisible();
		await expect(page.locator('article', { hasText: 'Original' })).toHaveCount(0);
	});

	test('delete from edit dialog removes the task', async ({ page }) => {
		await addTodo(page, 'To be deleted');
		const row = page.locator('article', { hasText: 'To be deleted' });
		await row.getByRole('button', { name: 'Edit To be deleted' }).click();

		// Accept the confirm() dialog that Delete fires.
		page.once('dialog', (d) => d.accept());
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

		await expect(page.locator('article', { hasText: 'To be deleted' })).toHaveCount(0);
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

		// Friend tile is rendered as an article. Friends with both streams
		// overdue (defaults; just-created → never logged) show on Focus.
		const tile = page.locator('article', { hasText: 'Alex' });
		await expect(tile).toBeVisible();
		// Both stream buttons are present (aria-labels on the per-stream
		// tap targets).
		await expect(tile.getByRole('button', { name: /Log contacted/ })).toBeVisible();
		await expect(tile.getByRole('button', { name: /Log seen/ })).toBeVisible();

		// Tap the contacted stat → logs a contacted completion. After the
		// brief "Snailed it!" flash and reload, the contacted row should
		// move off overdue (since contacted target is 7d and we just logged).
		await tile.getByRole('button', { name: /Log contacted/ }).click();
		// Wait for reload, then verify the contacted line shows "0d" and is no
		// longer in danger color. The seen row remains overdue (never logged).
		await expect(tile.getByText('0d')).toBeVisible();
	});

	test('friend with both streams fresh hides from Focus, appears on All', async ({ page }) => {
		// Set up: friends category with very generous targets so a single
		// "Contacted" + "Saw" tap leaves the friend in the fresh band.
		await page.goto('/settings');
		await page.getByRole('button', { name: 'friends', exact: true }).click();
		await page.getByLabel('Name').fill('Calm friends');
		await page.getByLabel('Default contacted (days)').fill('30');
		await page.getByLabel('Default seen (days)').fill('90');
		await page.getByRole('button', { name: 'Add category' }).click();
		// Wait for the category card to render before navigating — otherwise the
		// follow-up category dropdown can race the store reload.
		await expect(page.locator('article', { hasText: 'Calm friends' })).toBeVisible();

		await page.goto('/');
		await page.getByRole('button', { name: 'New task' }).first().click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'New task' });
		await dialog.getByRole('button', { name: 'friend', exact: true }).click();
		await dialog.getByLabel('Name').fill('Calm Pat');
		await dialog.getByLabel('Category').selectOption({ label: 'Calm friends' });
		await dialog.getByRole('button', { name: 'Add friend' }).click();

		const tile = page.locator('article', { hasText: 'Calm Pat' });
		// Brand new — both streams "never" → overdue → tile shows on Focus.
		await expect(tile).toBeVisible();

		// Log both streams. Now both are fresh.
		await tile.getByRole('button', { name: /Log contacted/ }).click();
		await page.waitForTimeout(800);
		await tile.getByRole('button', { name: /Log seen/ }).click();
		await page.waitForTimeout(800);

		// On Focus, the tile is no longer present.
		await page.goto('/');
		await expect(page.locator('article', { hasText: 'Calm Pat' })).toHaveCount(0);

		// On the All tab, the tile lives under the Friends section.
		await page.getByRole('link', { name: 'All' }).first().click();
		await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();
		await expect(page.locator('article', { hasText: 'Calm Pat' })).toBeVisible();
	});
});
