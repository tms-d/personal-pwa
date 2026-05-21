import { describe, it, expect } from 'vitest';
import {
	taskToRow,
	rowToTask,
	completionToRow,
	rowToCompletion,
	categoryToRow,
	rowToCategory,
	isRemoteNewer,
	outboxId,
	type TaskRow,
	type CompletionRow,
	type CategoryRow
} from '$lib/sync-helpers';
import type { Task, Completion, Category } from '$lib/types';

const USER_ID = 'user-1';

describe('taskToRow / rowToTask roundtrip', () => {
	it('roundtrips a minimal todo', () => {
		const task: Task = {
			id: 't1',
			title: 'Hello',
			kind: 'todo',
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		const back = rowToTask(taskToRow(task, USER_ID));
		expect(back).toEqual(task);
	});

	it('roundtrips a recurring task with all fields', () => {
		const task: Task = {
			id: 't2',
			title: 'Weekly review',
			notes: 'on Sunday',
			tags: ['work', 'review'],
			kind: 'recurring',
			recurrence: { period: 'week', every: 1, dueOn: 7 },
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-02T00:00:00.000Z',
			archivedAt: '2026-05-03T00:00:00.000Z'
		};
		const back = rowToTask(taskToRow(task, USER_ID));
		expect(back).toEqual(task);
	});

	it('roundtrips dueOn = "end"', () => {
		const task: Task = {
			id: 't3',
			title: 'Pay rent',
			kind: 'recurring',
			recurrence: { period: 'month', dueOn: 'end' },
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		const back = rowToTask(taskToRow(task, USER_ID));
		expect(back.recurrence?.dueOn).toBe('end');
	});

	it('roundtrips a cadence task', () => {
		const task: Task = {
			id: 't4',
			title: 'Call mom',
			kind: 'cadence',
			cadence: { targetIntervalDays: 14 },
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		const back = rowToTask(taskToRow(task, USER_ID));
		expect(back).toEqual(task);
	});

	it('row → task drops nulls into undefined', () => {
		const row: TaskRow = {
			id: 't5',
			user_id: USER_ID,
			title: 'X',
			notes: null,
			tags: null,
			kind: 'todo',
			category_id: null,
			recurrence_period: null,
			recurrence_every: null,
			recurrence_due_on: null,
			cadence_target_interval_days: null,
			contacted_target_days: null,
			seen_target_days: null,
			created_at: '2026-05-01T00:00:00.000Z',
			archived_at: null,
			updated_at: '2026-05-01T00:00:00.000Z',
			deleted_at: null
		};
		const task = rowToTask(row);
		expect(task.notes).toBeUndefined();
		expect(task.tags).toBeUndefined();
		expect(task.archivedAt).toBeUndefined();
		expect(task.recurrence).toBeUndefined();
		expect(task.cadence).toBeUndefined();
		expect(task.categoryId).toBeUndefined();
	});

	it('roundtrips categoryId', () => {
		const task: Task = {
			id: 't6',
			title: 'Vacuum',
			kind: 'cadence',
			categoryId: 'cat-house',
			cadence: { targetIntervalDays: 7 },
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		const back = rowToTask(taskToRow(task, USER_ID));
		expect(back.categoryId).toBe('cat-house');
	});
});

describe('categoryToRow / rowToCategory roundtrip', () => {
	it('roundtrips a general category', () => {
		const c: Category = {
			id: 'cat-1',
			name: 'House',
			color: 'var(--color-sage)',
			sortOrder: 0,
			kind: 'general',
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		expect(rowToCategory(categoryToRow(c, USER_ID))).toEqual(c);
	});

	it('roundtrips a friends-kind category with defaults', () => {
		const c: Category = {
			id: 'cat-friends',
			name: 'Close friends',
			color: 'var(--color-blush)',
			sortOrder: 2,
			kind: 'friends',
			defaultContactedDays: 14,
			defaultSeenDays: 60,
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		expect(rowToCategory(categoryToRow(c, USER_ID))).toEqual(c);
	});

	it('roundtrips a soft-deleted category', () => {
		const c: Category = {
			id: 'cat-2',
			name: 'Old',
			color: 'var(--color-blush)',
			sortOrder: 3,
			kind: 'general',
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-02T00:00:00.000Z',
			deletedAt: '2026-05-02T00:00:00.000Z'
		};
		expect(rowToCategory(categoryToRow(c, USER_ID))).toEqual(c);
	});

	it('row → category drops null deleted_at to undefined', () => {
		const row: CategoryRow = {
			id: 'cat-3',
			user_id: USER_ID,
			name: 'Gaming',
			color: 'var(--color-sky)',
			sort_order: 1,
			kind: 'general',
			default_contacted_days: null,
			default_seen_days: null,
			created_at: '2026-05-01T00:00:00.000Z',
			updated_at: '2026-05-01T00:00:00.000Z',
			deleted_at: null
		};
		const cat = rowToCategory(row);
		expect(cat.deletedAt).toBeUndefined();
	});

	it('rows missing kind (pre-friends-migration data) default to general', () => {
		const row = {
			id: 'cat-legacy',
			user_id: USER_ID,
			name: 'Old',
			color: 'var(--color-sage)',
			sort_order: 0,
			default_contacted_days: null,
			default_seen_days: null,
			created_at: '2026-05-01T00:00:00.000Z',
			updated_at: '2026-05-01T00:00:00.000Z',
			deleted_at: null
		} as unknown as CategoryRow; // pre-migration shape
		expect(rowToCategory(row).kind).toBe('general');
	});
});

describe('completionToRow / rowToCompletion roundtrip', () => {
	it('roundtrips a single-stream completion', () => {
		const c: Completion = {
			id: 'c1',
			taskId: 't1',
			at: '2026-05-20T10:00:00.000Z',
			updatedAt: '2026-05-20T10:00:00.000Z'
		};
		expect(rowToCompletion(completionToRow(c, USER_ID))).toEqual(c);
	});

	it('roundtrips a contacted-stream completion', () => {
		const c: Completion = {
			id: 'c-contacted',
			taskId: 'friend-1',
			at: '2026-05-20T10:00:00.000Z',
			updatedAt: '2026-05-20T10:00:00.000Z',
			stream: 'contacted'
		};
		expect(rowToCompletion(completionToRow(c, USER_ID))).toEqual(c);
	});

	it('roundtrips a seen-stream completion', () => {
		const c: Completion = {
			id: 'c-seen',
			taskId: 'friend-1',
			at: '2026-05-20T10:00:00.000Z',
			updatedAt: '2026-05-20T10:00:00.000Z',
			stream: 'seen'
		};
		expect(rowToCompletion(completionToRow(c, USER_ID))).toEqual(c);
	});

	it('roundtrips a soft-deleted completion', () => {
		const c: Completion = {
			id: 'c2',
			taskId: 't1',
			at: '2026-05-20T10:00:00.000Z',
			updatedAt: '2026-05-20T10:01:00.000Z',
			deletedAt: '2026-05-20T10:01:00.000Z'
		};
		expect(rowToCompletion(completionToRow(c, USER_ID))).toEqual(c);
	});
});

describe('isRemoteNewer', () => {
	const A = '2026-05-20T10:00:00.000Z';
	const B = '2026-05-20T10:00:01.000Z';

	it('returns true when local is missing', () => {
		expect(isRemoteNewer(undefined, A, false)).toBe(true);
		expect(isRemoteNewer(undefined, A, true)).toBe(true);
	});

	it('strict: equal timestamps do NOT count as newer', () => {
		expect(isRemoteNewer(A, A, true)).toBe(false);
	});

	it('non-strict: equal timestamps DO count as newer', () => {
		expect(isRemoteNewer(A, A, false)).toBe(true);
	});

	it('strictly newer remote always wins', () => {
		expect(isRemoteNewer(A, B, true)).toBe(true);
		expect(isRemoteNewer(A, B, false)).toBe(true);
	});

	it('older remote always loses', () => {
		expect(isRemoteNewer(B, A, true)).toBe(false);
		expect(isRemoteNewer(B, A, false)).toBe(false);
	});
});

describe('outboxId', () => {
	it('produces a deterministic key per (table, id)', () => {
		expect(outboxId('tasks', 'abc')).toBe('tasks:abc');
		expect(outboxId('completions', 'abc')).toBe('completions:abc');
		expect(outboxId('tasks', 'abc')).toBe(outboxId('tasks', 'abc'));
	});
});

// Small consistency check on shapes (helps catch interface drift between
// helpers and the rest of the codebase).
describe('row shapes', () => {
	it('TaskRow has expected keys', () => {
		const task: Task = {
			id: 't',
			title: 'x',
			kind: 'todo',
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		const row = taskToRow(task, USER_ID);
		expect(Object.keys(row).sort()).toEqual(
			[
				'archived_at',
				'cadence_target_interval_days',
				'category_id',
				'contacted_target_days',
				'created_at',
				'deleted_at',
				'id',
				'kind',
				'notes',
				'recurrence_due_on',
				'recurrence_every',
				'recurrence_period',
				'seen_target_days',
				'tags',
				'title',
				'updated_at',
				'user_id'
			].sort()
		);
	});

	it('CategoryRow has expected keys', () => {
		const c: Category = {
			id: 'cat',
			name: 'X',
			color: 'var(--color-sage)',
			sortOrder: 0,
			kind: 'general',
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		};
		const row = categoryToRow(c, USER_ID);
		expect(Object.keys(row).sort()).toEqual(
			[
				'color',
				'created_at',
				'default_contacted_days',
				'default_seen_days',
				'deleted_at',
				'id',
				'kind',
				'name',
				'sort_order',
				'updated_at',
				'user_id'
			].sort()
		);
	});

	it('CompletionRow has expected keys', () => {
		const c: Completion = {
			id: 'c',
			taskId: 't',
			at: '2026-05-20T10:00:00.000Z',
			updatedAt: '2026-05-20T10:00:00.000Z'
		};
		const row: CompletionRow = completionToRow(c, USER_ID);
		expect(Object.keys(row).sort()).toEqual(
			['at', 'deleted_at', 'id', 'stream', 'task_id', 'updated_at', 'user_id'].sort()
		);
	});
});
