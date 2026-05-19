import { loadTasksWithLast } from './tasks';
import type { TaskWithLast } from './types';

interface TaskStore {
	items: TaskWithLast[];
	loaded: boolean;
}

export const taskStore: TaskStore = $state({
	items: [],
	loaded: false
});

export async function reloadTasks(): Promise<void> {
	taskStore.items = await loadTasksWithLast();
	taskStore.loaded = true;
}
