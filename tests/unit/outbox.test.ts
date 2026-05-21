import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module mocks — must be set up before importing the SUT.
const upsert = vi.fn();
const supabaseStub = {
	from: vi.fn(() => ({ upsert }))
};
let supabaseReturn: typeof supabaseStub | null = supabaseStub;
const authStub: { user: { id: string } | null } = { user: { id: 'user-1' } };

vi.mock('$lib/supabase', () => ({
	getSupabase: () => supabaseReturn
}));

vi.mock('$lib/auth.svelte', () => ({
	authState: authStub,
	onAuthChange: () => () => {},
	signInWithGitHub: vi.fn(),
	signOut: vi.fn(),
	initAuth: vi.fn()
}));

vi.mock('$lib/store.svelte', () => ({
	taskStore: { items: [], loaded: false },
	categoryStore: { items: [], loaded: false },
	reloadTasks: vi.fn().mockResolvedValue(undefined),
	reloadCategories: vi.fn().mockResolvedValue(undefined),
	reloadAll: vi.fn().mockResolvedValue(undefined)
}));

const { enqueuePush, drainOutbox, syncStatus, clearLocalData } = await import(
	'$lib/sync.svelte'
);
const { db } = await import('$lib/db');
const { createTask } = await import('$lib/tasks');

beforeEach(() => {
	upsert.mockReset();
	upsert.mockResolvedValue({ error: null });
	supabaseStub.from.mockClear();
	supabaseReturn = supabaseStub;
	authStub.user = { id: 'user-1' };
	if (typeof navigator !== 'undefined') {
		Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
	}
});

describe('enqueuePush', () => {
	it('dedupes repeated calls for the same (table, id)', async () => {
		// Block draining from succeeding so the entries survive long enough to assert on.
		upsert.mockResolvedValue({ error: new Error('blocked') });
		await db.tasks.add({
			id: 'abc',
			title: 'A',
			kind: 'todo',
			createdAt: '2026-05-01T00:00:00.000Z',
			updatedAt: '2026-05-01T00:00:00.000Z'
		});

		await enqueuePush('tasks', 'abc');
		await enqueuePush('tasks', 'abc');
		await drainOutbox(); // wait for any in-flight drain to settle

		const entries = (await db.outbox.toArray()).filter((e) => e.id === 'tasks:abc');
		expect(entries).toHaveLength(1);
	});

	it('is a no-op when not signed in', async () => {
		authStub.user = null;
		await enqueuePush('tasks', 'abc');
		expect(await db.outbox.count()).toBe(0);
	});

	it('is a no-op when supabase is not configured', async () => {
		supabaseReturn = null;
		await enqueuePush('tasks', 'abc');
		expect(await db.outbox.count()).toBe(0);
	});
});

describe('drainOutbox', () => {
	it('pushes pending tasks then deletes outbox entry', async () => {
		const task = await createTask({ title: 'X', kind: 'todo' });
		// createTask enqueues, drain runs in the background — wait for it.
		await drainOutbox();
		expect(upsert).toHaveBeenCalled();
		const args = upsert.mock.calls[upsert.mock.calls.length - 1][0];
		expect(args.id).toBe(task.id);
		expect(args.user_id).toBe('user-1');
		expect(await db.outbox.count()).toBe(0);
		expect(syncStatus.pendingCount).toBe(0);
	});

	it('stops on first failure and leaves the remaining entries', async () => {
		await db.tasks.bulkAdd([
			{
				id: 'a',
				title: 'A',
				kind: 'todo',
				createdAt: '2026-05-01T00:00:00.000Z',
				updatedAt: '2026-05-01T00:00:00.000Z'
			},
			{
				id: 'b',
				title: 'B',
				kind: 'todo',
				createdAt: '2026-05-01T00:00:00.000Z',
				updatedAt: '2026-05-01T00:00:00.000Z'
			}
		]);
		await db.outbox.bulkPut([
			{
				id: 'tasks:a',
				table: 'tasks',
				rowId: 'a',
				queuedAt: '2026-05-20T10:00:00.000Z'
			},
			{
				id: 'tasks:b',
				table: 'tasks',
				rowId: 'b',
				queuedAt: '2026-05-20T10:00:01.000Z'
			}
		]);
		upsert.mockResolvedValueOnce({ error: new Error('boom') });
		await drainOutbox();
		expect(await db.outbox.count()).toBe(2);
		expect(upsert).toHaveBeenCalledTimes(1);
	});

	it('is a no-op when offline', async () => {
		Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
		await enqueuePush('tasks', 'a');
		await drainOutbox();
		expect(upsert).not.toHaveBeenCalled();
	});

	it('is a no-op when signed out', async () => {
		await enqueuePush('tasks', 'a');
		authStub.user = null;
		await drainOutbox();
		expect(upsert).not.toHaveBeenCalled();
	});

	it('drops outbox entries that point at a missing row', async () => {
		// Force-enqueue without writing a row
		await db.outbox.put({
			id: 'tasks:ghost',
			table: 'tasks',
			rowId: 'ghost',
			queuedAt: new Date().toISOString()
		});
		await drainOutbox();
		expect(await db.outbox.count()).toBe(0);
		expect(upsert).not.toHaveBeenCalled();
	});
});

describe('clearLocalData', () => {
	it('wipes tasks, completions, outbox and resets sync state', async () => {
		await createTask({ title: 'X', kind: 'todo' });
		await db.outbox.put({
			id: 'tasks:zzz',
			table: 'tasks',
			rowId: 'zzz',
			queuedAt: new Date().toISOString()
		});
		syncStatus.lastSyncedAt = '2026-05-20T10:00:00.000Z';
		syncStatus.error = 'something';
		syncStatus.state = 'error';
		syncStatus.pendingCount = 5;

		await clearLocalData();

		expect(await db.tasks.count()).toBe(0);
		expect(await db.completions.count()).toBe(0);
		expect(await db.outbox.count()).toBe(0);
		expect(syncStatus.pendingCount).toBe(0);
		expect(syncStatus.lastSyncedAt).toBeNull();
		expect(syncStatus.error).toBeNull();
		expect(syncStatus.state).toBe('idle');
	});
});
