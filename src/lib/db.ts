import Dexie, { type Table } from 'dexie';
import type { Task, Completion, Category } from './types';

export type SyncTable = 'tasks' | 'completions' | 'categories';

export interface OutboxEntry {
	id: string;
	table: SyncTable;
	rowId: string;
	queuedAt: string;
}

export class PPODB extends Dexie {
	tasks!: Table<Task, string>;
	completions!: Table<Completion, string>;
	categories!: Table<Category, string>;
	outbox!: Table<OutboxEntry, string>;

	constructor() {
		super('ppo');
		this.version(1).stores({
			tasks: 'id, kind, archivedAt, createdAt',
			completions: 'id, taskId, at'
		});
		this.version(2)
			.stores({
				tasks: 'id, kind, archivedAt, createdAt, updatedAt, deletedAt',
				completions: 'id, taskId, at, updatedAt, deletedAt'
			})
			.upgrade(async (tx) => {
				const now = new Date().toISOString();
				await tx
					.table('tasks')
					.toCollection()
					.modify((t) => {
						t.updatedAt = t.createdAt ?? now;
					});
				await tx
					.table('completions')
					.toCollection()
					.modify((c) => {
						c.updatedAt = c.at ?? now;
					});
			});
		this.version(3).stores({
			tasks: 'id, kind, archivedAt, createdAt, updatedAt, deletedAt',
			completions: 'id, taskId, at, updatedAt, deletedAt',
			outbox: 'id, queuedAt'
		});
		this.version(4).stores({
			tasks: 'id, kind, categoryId, archivedAt, createdAt, updatedAt, deletedAt',
			completions: 'id, taskId, at, updatedAt, deletedAt',
			categories: 'id, sortOrder, updatedAt, deletedAt',
			outbox: 'id, queuedAt'
		});
	}
}

export const db = new PPODB();

export function uid(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
