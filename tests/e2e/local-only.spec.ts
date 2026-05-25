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
		await page.getByRole('link', { name: 'Tasks' }).first().click();
		await expect(page).toHaveURL(/\/tasks/);

		await page.getByRole('link', { name: 'Friends' }).first().click();
		await expect(page).toHaveURL(/\/friends/);

		await page.getByRole('link', { name: 'Kids' }).first().click();
		await expect(page).toHaveURL(/\/kids/);

		// History lives in the account menu
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

		// Create a friend via the Friends-tab "+ New friend" header button.
		await page.goto('/friends');
		await page.getByRole('button', { name: 'New friend' }).click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'New friend' });
		// Kind is preselected to 'friend'.
		await dialog.getByLabel('Name').fill('Alex');
		await dialog.getByLabel('Category').selectOption({ label: 'Close friends' });
		// Prefilled from category defaults.
		await expect(dialog.getByLabel('Contacted (days)')).toHaveValue('7');
		await expect(dialog.getByLabel('Seen (days)')).toHaveValue('30');
		await dialog.getByRole('button', { name: 'Add friend' }).click();

		// Friend appears on the Friends page.
		const tile = page.locator('[role="button"]', { hasText: 'Alex' });
		await expect(tile.first()).toBeVisible();
	});

	test('friends do not appear on Focus', async ({ page }) => {
		// Create a friends category + friend.
		await page.goto('/settings');
		await page.getByRole('button', { name: 'friends', exact: true }).click();
		await page.getByLabel('Name').fill('Calm friends');
		await page.getByLabel('Default contacted (days)').fill('30');
		await page.getByLabel('Default seen (days)').fill('90');
		await page.getByRole('button', { name: 'Add category' }).click();
		await expect(page.locator('article', { hasText: 'Calm friends' })).toBeVisible();

		await page.goto('/friends');
		await page.getByRole('button', { name: 'New friend' }).click();
		const dialog = page.getByRole('dialog').filter({ hasText: 'New friend' });
		await dialog.getByLabel('Name').fill('Calm Pat');
		await dialog.getByLabel('Category').selectOption({ label: 'Calm friends' });
		await dialog.getByRole('button', { name: 'Add friend' }).click();

		// Friend appears on Friends.
		await expect(page.getByText('Calm Pat')).toBeVisible();

		// Focus never shows friends, regardless of their urgency.
		await page.goto('/');
		await expect(page.getByText('Calm Pat')).toHaveCount(0);
	});
});
