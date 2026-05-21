import { describe, it, expect } from 'vitest';
import {
	createTask,
	completeTask,
	uncompleteTask,
	loadTasksWithLast,
	computeStatus
} from '$lib/tasks';
import { db } from '$lib/db';

describe('friend task data flow', () => {
	it('completeTask records the stream and loadTasksWithLast populates per-stream lasts', async () => {
		const friend = await createTask({
			title: 'Alex',
			kind: 'friend',
			contactedTargetDays: 14,
			seenTargetDays: 60
		});

		await completeTask(friend.id, new Date('2026-05-10T12:00:00'), 'contacted');
		await completeTask(friend.id, new Date('2026-04-01T12:00:00'), 'seen');

		const rows = await loadTasksWithLast();
		const loaded = rows.find((r) => r.id === friend.id);
		expect(loaded?.lastContactedAt).toContain('2026-05-10');
		expect(loaded?.lastSeenAt).toContain('2026-04-01');
		expect(loaded?.lastCompletedAt).toBeNull();
	});

	it('per-stream uncomplete only soft-deletes that stream', async () => {
		const friend = await createTask({
			title: 'Sam',
			kind: 'friend',
			contactedTargetDays: 14,
			seenTargetDays: 60
		});

		await completeTask(friend.id, new Date('2026-05-10T12:00:00'), 'contacted');
		await completeTask(friend.id, new Date('2026-05-12T12:00:00'), 'seen');

		await uncompleteTask(friend.id, 'contacted');

		const rows = await loadTasksWithLast();
		const loaded = rows.find((r) => r.id === friend.id);
		expect(loaded?.lastContactedAt).toBeNull();
		expect(loaded?.lastSeenAt).toContain('2026-05-12');
	});

	it('streams are independent — completing one does not affect the other', async () => {
		const friend = await createTask({
			title: 'Pat',
			kind: 'friend',
			contactedTargetDays: 14,
			seenTargetDays: 60
		});

		await completeTask(friend.id, new Date('2026-05-10T12:00:00'), 'contacted');

		const rows = await loadTasksWithLast();
		const loaded = rows.find((r) => r.id === friend.id);
		expect(loaded?.lastContactedAt).toBeTruthy();
		expect(loaded?.lastSeenAt).toBeNull();
	});

	it('existing single-stream tasks (no stream field) are unaffected', async () => {
		const todo = await createTask({ title: 'Take out trash', kind: 'todo' });
		await completeTask(todo.id);

		const rows = await loadTasksWithLast();
		const loaded = rows.find((r) => r.id === todo.id);
		expect(loaded?.lastCompletedAt).toBeTruthy();
	});
});

describe('computeStatus for friend kind', () => {
	const now = new Date('2026-05-21T12:00:00Z');

	it('overall urgency = worst of the two streams', async () => {
		// Contacted: 30 days ago, target 14 → overdue (16 days over)
		// Seen: 5 days ago, target 60 → fresh
		const status = computeStatus(
			{
				id: 'f1',
				title: 'X',
				kind: 'friend',
				contactedTargetDays: 14,
				seenTargetDays: 60,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
				lastCompletedAt: null,
				lastContactedAt: new Date('2026-04-21T12:00:00Z').toISOString(),
				lastSeenAt: new Date('2026-05-16T12:00:00Z').toISOString()
			},
			now
		);
		expect(status.urgency).toBe('overdue');
		expect(status.streams?.contacted.urgency).toBe('overdue');
		expect(status.streams?.seen.urgency).toBe('fresh');
	});

	it('never-contacted is overdue regardless of how recently seen', () => {
		const status = computeStatus(
			{
				id: 'f2',
				title: 'X',
				kind: 'friend',
				contactedTargetDays: 14,
				seenTargetDays: 60,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
				lastCompletedAt: null,
				lastContactedAt: null,
				lastSeenAt: new Date('2026-05-20T12:00:00Z').toISOString()
			},
			now
		);
		expect(status.streams?.contacted.urgency).toBe('overdue');
		expect(status.streams?.contacted.label).toBe('never');
		expect(status.urgency).toBe('overdue');
	});

	it('falls back to sensible defaults if target days are missing', () => {
		const status = computeStatus(
			{
				id: 'f3',
				title: 'X',
				kind: 'friend',
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
				lastCompletedAt: null,
				lastContactedAt: null,
				lastSeenAt: null
			},
			now
		);
		// Both streams never-done → overdue
		expect(status.urgency).toBe('overdue');
		expect(status.streams).toBeDefined();
	});

	it('friend tasks are always visible (no "done" terminal state)', () => {
		const status = computeStatus(
			{
				id: 'f4',
				title: 'X',
				kind: 'friend',
				contactedTargetDays: 14,
				seenTargetDays: 60,
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
				lastCompletedAt: null,
				lastContactedAt: new Date('2026-05-21T12:00:00Z').toISOString(),
				lastSeenAt: new Date('2026-05-21T12:00:00Z').toISOString()
			},
			now
		);
		expect(status.visible).toBe(true);
	});
});
