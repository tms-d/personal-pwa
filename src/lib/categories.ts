import type { Category } from './types';
import { db, uid } from './db';
import { enqueuePush } from './sync.svelte';

export const CATEGORY_COLORS = [
	{ name: 'sage', value: 'var(--color-sage)' },
	{ name: 'sky', value: 'var(--color-sky)' },
	{ name: 'butter', value: 'var(--color-butter)' },
	{ name: 'blush', value: 'var(--color-blush)' },
	{ name: 'lavender', value: 'var(--color-lavender)' }
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0].value;

export async function listCategories(): Promise<Category[]> {
	const all = await db.categories.toArray();
	return all.filter((c) => !c.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createCategory(
	input: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'> & {
		sortOrder?: number;
	}
): Promise<Category> {
	const now = new Date().toISOString();
	const existing = await listCategories();
	const maxOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
	const category: Category = {
		...input,
		id: uid(),
		sortOrder: input.sortOrder ?? maxOrder + 1,
		createdAt: now,
		updatedAt: now
	};
	await db.categories.add(category);
	void enqueuePush('categories', category.id);
	return category;
}

export async function updateCategory(
	id: string,
	patch: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Category | null> {
	const existing = await db.categories.get(id);
	if (!existing) return null;
	const updated: Category = {
		...existing,
		...patch,
		id: existing.id,
		createdAt: existing.createdAt,
		updatedAt: new Date().toISOString()
	};
	await db.categories.put(updated);
	void enqueuePush('categories', updated.id);
	return updated;
}

export async function deleteCategory(id: string): Promise<void> {
	const existing = await db.categories.get(id);
	if (!existing) return;
	const now = new Date().toISOString();
	const updated: Category = { ...existing, deletedAt: now, updatedAt: now };
	await db.categories.put(updated);
	void enqueuePush('categories', updated.id);

	// Tasks fall back to Uncategorized — clear their categoryId locally so
	// the UI reflects it immediately. Supabase already does ON DELETE SET NULL,
	// but our soft-delete doesn't trigger that, so do it ourselves.
	const tasks = await db.tasks.where('categoryId').equals(id).toArray();
	for (const t of tasks) {
		const updatedTask = { ...t, categoryId: undefined, updatedAt: now };
		await db.tasks.put(updatedTask);
		void enqueuePush('tasks', updatedTask.id);
	}
}

export async function reorderCategory(id: string, direction: 'up' | 'down'): Promise<void> {
	const all = await listCategories();
	const idx = all.findIndex((c) => c.id === id);
	if (idx < 0) return;
	const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
	if (swapIdx < 0 || swapIdx >= all.length) return;

	const a = all[idx];
	const b = all[swapIdx];
	const now = new Date().toISOString();
	await db.categories.put({ ...a, sortOrder: b.sortOrder, updatedAt: now });
	await db.categories.put({ ...b, sortOrder: a.sortOrder, updatedAt: now });
	void enqueuePush('categories', a.id);
	void enqueuePush('categories', b.id);
}
