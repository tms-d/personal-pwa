import { describe, it, expect } from 'vitest';
import {
	createCategory,
	updateCategory,
	deleteCategory,
	reorderCategory,
	listCategories
} from '$lib/categories';
import { createTask } from '$lib/tasks';
import { db } from '$lib/db';

describe('createCategory', () => {
	it('persists with id, timestamps, and an auto-assigned sortOrder', async () => {
		const a = await createCategory({ name: 'House', color: 'var(--color-sage)', kind: 'general' });
		const b = await createCategory({ name: 'Gaming', color: 'var(--color-sky)', kind: 'general' });
		expect(a.id).toBeTruthy();
		expect(a.sortOrder).toBe(0);
		expect(b.sortOrder).toBe(1);
		expect(a.createdAt).toBe(a.updatedAt);

		const stored = await db.categories.get(a.id);
		expect(stored?.name).toBe('House');
	});
});

describe('updateCategory', () => {
	it('mutates fields and bumps updatedAt, preserves createdAt', async () => {
		const cat = await createCategory({ name: 'A', color: 'var(--color-sage)', kind: 'general' });
		await new Promise((r) => setTimeout(r, 5));
		const updated = await updateCategory(cat.id, { name: 'B', color: 'var(--color-blush)' });
		expect(updated?.name).toBe('B');
		expect(updated?.color).toBe('var(--color-blush)');
		expect(updated?.createdAt).toBe(cat.createdAt);
		expect(updated?.updatedAt).not.toBe(cat.updatedAt);
	});

	it('returns null for missing id', async () => {
		const result = await updateCategory('does-not-exist', { name: 'X' });
		expect(result).toBeNull();
	});
});

describe('deleteCategory', () => {
	it('soft-deletes the category and clears categoryId on its tasks', async () => {
		const cat = await createCategory({ name: 'Soon gone', color: 'var(--color-sage)', kind: 'general' });
		const task = await createTask({
			title: 'Belongs to it',
			kind: 'todo',
			categoryId: cat.id
		});

		await deleteCategory(cat.id);

		const storedCat = await db.categories.get(cat.id);
		expect(storedCat?.deletedAt).toBeTruthy();

		const storedTask = await db.tasks.get(task.id);
		expect(storedTask?.categoryId).toBeUndefined();
	});

	it('is a no-op for missing id', async () => {
		await expect(deleteCategory('ghost')).resolves.toBeUndefined();
	});
});

describe('listCategories', () => {
	it('returns non-deleted categories ordered by sortOrder', async () => {
		const a = await createCategory({ name: 'A', color: 'var(--color-sage)', kind: 'general' });
		const b = await createCategory({ name: 'B', color: 'var(--color-sky)', kind: 'general' });
		const c = await createCategory({ name: 'C', color: 'var(--color-blush)', kind: 'general' });

		await deleteCategory(b.id);

		const list = await listCategories();
		expect(list.map((x) => x.id)).toEqual([a.id, c.id]);
	});
});

describe('reorderCategory', () => {
	it('swaps sortOrder with the next category when moving down', async () => {
		const a = await createCategory({ name: 'A', color: 'var(--color-sage)', kind: 'general' });
		const b = await createCategory({ name: 'B', color: 'var(--color-sky)', kind: 'general' });
		const c = await createCategory({ name: 'C', color: 'var(--color-blush)', kind: 'general' });

		await reorderCategory(a.id, 'down');

		const list = await listCategories();
		expect(list.map((x) => x.id)).toEqual([b.id, a.id, c.id]);
	});

	it('is a no-op at the top boundary', async () => {
		const a = await createCategory({ name: 'A', color: 'var(--color-sage)', kind: 'general' });
		const b = await createCategory({ name: 'B', color: 'var(--color-sky)', kind: 'general' });
		await reorderCategory(a.id, 'up');
		const list = await listCategories();
		expect(list.map((x) => x.id)).toEqual([a.id, b.id]);
	});

	it('is a no-op at the bottom boundary', async () => {
		const a = await createCategory({ name: 'A', color: 'var(--color-sage)', kind: 'general' });
		const b = await createCategory({ name: 'B', color: 'var(--color-sky)', kind: 'general' });
		await reorderCategory(b.id, 'down');
		const list = await listCategories();
		expect(list.map((x) => x.id)).toEqual([a.id, b.id]);
	});
});
