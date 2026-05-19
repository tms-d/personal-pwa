import Dexie, { type Table } from 'dexie';
import type { Task, Completion } from './types';

export class PPODB extends Dexie {
	tasks!: Table<Task, string>;
	completions!: Table<Completion, string>;

	constructor() {
		super('ppo');
		this.version(1).stores({
			tasks: 'id, kind, archivedAt, createdAt',
			completions: 'id, taskId, at'
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
