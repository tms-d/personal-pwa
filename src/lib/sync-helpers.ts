// Pure conversion + merge helpers used by sync.svelte.ts. Lives in a plain
// .ts file (no runes) so it's easy to unit-test from Node without spinning
// up the Svelte compiler.

import type { Task, Completion } from './types';

export interface TaskRow {
	id: string;
	user_id: string;
	title: string;
	notes: string | null;
	tags: string[] | null;
	kind: string;
	recurrence_period: string | null;
	recurrence_every: number | null;
	recurrence_due_on: string | null;
	cadence_target_interval_days: number | null;
	created_at: string;
	archived_at: string | null;
	updated_at: string;
	deleted_at: string | null;
}

export interface CompletionRow {
	id: string;
	user_id: string;
	task_id: string;
	at: string;
	updated_at: string;
	deleted_at: string | null;
}

export function taskToRow(task: Task, userId: string): TaskRow {
	return {
		id: task.id,
		user_id: userId,
		title: task.title,
		notes: task.notes ?? null,
		tags: task.tags ?? null,
		kind: task.kind,
		recurrence_period: task.recurrence?.period ?? null,
		recurrence_every: task.recurrence?.every ?? null,
		recurrence_due_on:
			task.recurrence?.dueOn !== undefined ? String(task.recurrence.dueOn) : null,
		cadence_target_interval_days: task.cadence?.targetIntervalDays ?? null,
		created_at: task.createdAt,
		archived_at: task.archivedAt ?? null,
		updated_at: task.updatedAt,
		deleted_at: task.deletedAt ?? null
	};
}

export function rowToTask(row: TaskRow): Task {
	const task: Task = {
		id: row.id,
		title: row.title,
		notes: row.notes ?? undefined,
		tags: row.tags ?? undefined,
		kind: row.kind as Task['kind'],
		createdAt: row.created_at,
		archivedAt: row.archived_at ?? undefined,
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at ?? undefined
	};
	if (row.recurrence_period) {
		task.recurrence = {
			period: row.recurrence_period as 'day' | 'week' | 'month' | 'year'
		};
		if (row.recurrence_every) task.recurrence.every = row.recurrence_every;
		if (row.recurrence_due_on !== null) {
			task.recurrence.dueOn =
				row.recurrence_due_on === 'end' ? 'end' : Number(row.recurrence_due_on);
		}
	}
	if (row.cadence_target_interval_days !== null) {
		task.cadence = { targetIntervalDays: row.cadence_target_interval_days };
	}
	return task;
}

export function completionToRow(c: Completion, userId: string): CompletionRow {
	return {
		id: c.id,
		user_id: userId,
		task_id: c.taskId,
		at: c.at,
		updated_at: c.updatedAt,
		deleted_at: c.deletedAt ?? null
	};
}

export function rowToCompletion(row: CompletionRow): Completion {
	return {
		id: row.id,
		taskId: row.task_id,
		at: row.at,
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at ?? undefined
	};
}

// LWW merge predicate. `strict` controls > vs >=:
// fullSync uses non-strict so equal timestamps still re-put (harmless,
// keeps merge symmetric); realtime uses strict so own-write echoes
// (which arrive with a server-bumped updated_at) don't trigger reloads
// for content that didn't actually change.
export function isRemoteNewer(
	localUpdatedAt: string | undefined,
	remoteUpdatedAt: string,
	strict: boolean
): boolean {
	if (!localUpdatedAt) return true;
	return strict ? remoteUpdatedAt > localUpdatedAt : remoteUpdatedAt >= localUpdatedAt;
}

export function outboxId(table: 'tasks' | 'completions', rowId: string): string {
	return `${table}:${rowId}`;
}
