import { describe, it, expect } from 'vitest';
import {
	createTask,
	updateTask,
	completeTask,
	uncompleteTask,
	deleteTask,
	loadTasksWithLast
} from '$lib/tasks';
import { db } from '$lib/db';

describe('createTask', () => {
	it('persists with generated id and timestamps', async () => {
		const task = await createTask({ title: 'T', kind: 'todo' });
		expect(task.id).toBeTruthy();
		expect(task.createdAt).toBeTruthy();
		expect(task.updatedAt).toBe(task.createdAt);

		const stored = await db.tasks.get(task.id);
		expect(stored?.title).toBe('T');
	});
});

describe('updateTask', () => {
	it('mutates fields and bumps updatedAt, preserves createdAt', async () => {
		const task = await createTask({ title: 'Old', kind: 'todo' });
		await new Promise((r) => setTimeout(r, 5));
		const updated = await updateTask(task.id, { title: 'New' });
		expect(updated?.title).toBe('New');
		expect(updated?.createdAt).toBe(task.createdAt);
		expect(updated?.updatedAt).not.toBe(task.updatedAt);
	});

	it('returns null for missing id', async () => {
		const result = await updateTask('does-not-exist', { title: 'X' });
		expect(result).toBeNull();
	});

	it('ignores attempts to overwrite id / createdAt / updatedAt via patch', async () => {
		const task = await createTask({ title: 'A', kind: 'todo' });
		// Force the patch type to test the runtime guard against bad callers.
		const evilPatch = {
			id: 'evil',
			createdAt: '1999-01-01T00:00:00.000Z',
			title: 'B'
		} as Parameters<typeof updateTask>[1];
		const updated = await updateTask(task.id, evilPatch);
		expect(updated?.id).toBe(task.id);
		expect(updated?.createdAt).toBe(task.createdAt);
	});
});

describe('completeTask / uncompleteTask', () => {
	it('completing creates a completion row', async () => {
		const task = await createTask({ title: 'C', kind: 'todo' });
		await completeTask(task.id);
		const cs = await db.completions.where('taskId').equals(task.id).toArray();
		expect(cs).toHaveLength(1);
		expect(cs[0].deletedAt).toBeUndefined();
	});

	it('uncompleting soft-deletes the most recent completion', async () => {
		const task = await createTask({ title: 'C', kind: 'todo' });
		await completeTask(task.id, new Date('2026-05-19T12:00:00'));
		await completeTask(task.id, new Date('2026-05-20T12:00:00'));

		await uncompleteTask(task.id);

		const cs = await db.completions.where('taskId').equals(task.id).toArray();
		const live = cs.filter((c) => !c.deletedAt);
		expect(live).toHaveLength(1);
		expect(live[0].at).toContain('2026-05-19');
	});

	it('uncomplete on a task without completions is a no-op', async () => {
		const task = await createTask({ title: 'C', kind: 'todo' });
		await expect(uncompleteTask(task.id)).resolves.toBeUndefined();
	});
});

describe('deleteTask', () => {
	it('soft-deletes the task and its completions', async () => {
		const task = await createTask({ title: 'D', kind: 'todo' });
		await completeTask(task.id);
		await deleteTask(task.id);

		const t = await db.tasks.get(task.id);
		expect(t?.deletedAt).toBeTruthy();

		const cs = await db.completions.where('taskId').equals(task.id).toArray();
		expect(cs.every((c) => !!c.deletedAt)).toBe(true);
	});
});

describe('loadTasksWithLast', () => {
	it('joins last completion per task and filters deleted ones', async () => {
		const a = await createTask({ title: 'A', kind: 'todo' });
		const b = await createTask({ title: 'B', kind: 'todo' });
		const c = await createTask({ title: 'C', kind: 'todo' });

		await completeTask(a.id, new Date('2026-05-18T12:00:00'));
		await completeTask(a.id, new Date('2026-05-20T12:00:00'));
		await completeTask(b.id, new Date('2026-05-19T12:00:00'));

		await deleteTask(c.id);

		const rows = await loadTasksWithLast();
		const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
		expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
		expect(byId[a.id].lastCompletedAt).toContain('2026-05-20');
		expect(byId[b.id].lastCompletedAt).toContain('2026-05-19');
	});

	it('ignores soft-deleted completions when computing last', async () => {
		const t = await createTask({ title: 'T', kind: 'todo' });
		await completeTask(t.id, new Date('2026-05-20T12:00:00'));
		await uncompleteTask(t.id);

		const rows = await loadTasksWithLast();
		expect(rows).toHaveLength(1);
		expect(rows[0].lastCompletedAt).toBeNull();
	});
});
