import { loadTasksWithLast } from './tasks';
import { listCategories } from './categories';
import type { TaskWithLast, Category } from './types';

interface TaskStore {
	items: TaskWithLast[];
	loaded: boolean;
}

interface CategoryStore {
	items: Category[];
	loaded: boolean;
}

export const taskStore: TaskStore = $state({
	items: [],
	loaded: false
});

export const categoryStore: CategoryStore = $state({
	items: [],
	loaded: false
});

export async function reloadTasks(): Promise<void> {
	taskStore.items = await loadTasksWithLast();
	taskStore.loaded = true;
}

export async function reloadCategories(): Promise<void> {
	categoryStore.items = await listCategories();
	categoryStore.loaded = true;
}

export async function reloadAll(): Promise<void> {
	await Promise.all([reloadTasks(), reloadCategories()]);
}
