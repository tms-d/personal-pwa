import { describe, it, expect } from 'vitest';
import {
	periodStart,
	periodEnd,
	daysSince,
	computeStatus
} from '$lib/tasks';
import type { TaskWithLast } from '$lib/types';

function withLast(overrides: Partial<TaskWithLast>): TaskWithLast {
	return {
		id: 't1',
		title: 'Task',
		kind: 'todo',
		createdAt: '2026-05-01T00:00:00.000Z',
		updatedAt: '2026-05-01T00:00:00.000Z',
		lastCompletedAt: null,
		...overrides
	};
}

describe('periodStart', () => {
	it('day collapses to midnight of the same date', () => {
		const start = periodStart('day', new Date('2026-05-20T15:30:00'));
		expect(start.getHours()).toBe(0);
		expect(start.getDate()).toBe(20);
		expect(start.getMonth()).toBe(4);
	});

	it('week starts on Monday', () => {
		// Wednesday 2026-05-20
		const wed = new Date('2026-05-20T12:00:00');
		const start = periodStart('week', wed);
		expect(start.getDay()).toBe(1); // Monday
		expect(start.getDate()).toBe(18);
	});

	it('week from a Sunday goes back six days', () => {
		// Sunday 2026-05-24
		const sun = new Date('2026-05-24T12:00:00');
		const start = periodStart('week', sun);
		expect(start.getDay()).toBe(1);
		expect(start.getDate()).toBe(18);
	});

	it('week from a Monday stays put', () => {
		const mon = new Date('2026-05-18T12:00:00');
		const start = periodStart('week', mon);
		expect(start.getDate()).toBe(18);
	});

	it('month starts on day 1', () => {
		const start = periodStart('month', new Date('2026-05-20T12:00:00'));
		expect(start.getDate()).toBe(1);
		expect(start.getMonth()).toBe(4);
	});

	it('year starts on Jan 1', () => {
		const start = periodStart('year', new Date('2026-05-20T12:00:00'));
		expect(start.getDate()).toBe(1);
		expect(start.getMonth()).toBe(0);
		expect(start.getFullYear()).toBe(2026);
	});
});

describe('periodEnd', () => {
	it('day end is next midnight', () => {
		const end = periodEnd('day', new Date('2026-05-20T15:30:00'));
		expect(end.getDate()).toBe(21);
		expect(end.getHours()).toBe(0);
	});

	it('week end is next Monday', () => {
		const end = periodEnd('week', new Date('2026-05-20T12:00:00'));
		expect(end.getDay()).toBe(1);
		expect(end.getDate()).toBe(25);
	});

	it('month end rolls into next month', () => {
		const end = periodEnd('month', new Date('2026-05-20T12:00:00'));
		expect(end.getMonth()).toBe(5);
		expect(end.getDate()).toBe(1);
	});

	it('year end rolls into next year', () => {
		const end = periodEnd('year', new Date('2026-05-20T12:00:00'));
		expect(end.getFullYear()).toBe(2027);
		expect(end.getMonth()).toBe(0);
		expect(end.getDate()).toBe(1);
	});

	it('month end handles December → January', () => {
		const end = periodEnd('month', new Date('2026-12-15T12:00:00'));
		expect(end.getFullYear()).toBe(2027);
		expect(end.getMonth()).toBe(0);
	});
});

describe('daysSince', () => {
	it('returns null for null input', () => {
		expect(daysSince(null, new Date())).toBeNull();
	});

	it('returns 0 for now', () => {
		const now = new Date('2026-05-20T12:00:00.000Z');
		expect(daysSince('2026-05-20T12:00:00.000Z', now)).toBe(0);
	});

	it('returns floored day count', () => {
		const now = new Date('2026-05-25T12:00:00.000Z');
		expect(daysSince('2026-05-20T12:00:00.000Z', now)).toBe(5);
	});

	it('floors fractional days down', () => {
		const now = new Date('2026-05-21T11:00:00.000Z'); // 23 hours later
		expect(daysSince('2026-05-20T12:00:00.000Z', now)).toBe(0);
	});
});

describe('computeStatus', () => {
	const now = new Date('2026-05-20T12:00:00');

	it('archived task is not visible', () => {
		const task = withLast({ archivedAt: '2026-05-19T00:00:00.000Z' });
		const status = computeStatus(task, now);
		expect(status.visible).toBe(false);
		expect(status.label).toBe('Archived');
	});

	describe('todo', () => {
		it('not done → visible, label Todo', () => {
			const status = computeStatus(withLast({ kind: 'todo' }), now);
			expect(status.visible).toBe(true);
			expect(status.label).toBe('Todo');
		});

		it('done → not visible, label Done', () => {
			const status = computeStatus(
				withLast({ kind: 'todo', lastCompletedAt: '2026-05-19T12:00:00.000Z' }),
				now
			);
			expect(status.visible).toBe(false);
			expect(status.label).toBe('Done');
		});
	});

	describe('recurring', () => {
		it('done this period → not visible', () => {
			// Period = week. Monday 2026-05-18, completed on 19th (this week).
			const task = withLast({
				kind: 'recurring',
				recurrence: { period: 'week' },
				lastCompletedAt: '2026-05-19T12:00:00'
			});
			const status = computeStatus(task, now);
			expect(status.visible).toBe(false);
			expect(status.label).toContain('Done this');
		});

		it('completed last period → visible', () => {
			// Last week
			const task = withLast({
				kind: 'recurring',
				recurrence: { period: 'week' },
				lastCompletedAt: '2026-05-11T12:00:00'
			});
			const status = computeStatus(task, now);
			expect(status.visible).toBe(true);
		});

		it('never completed → visible, urgency depends on days left', () => {
			const task = withLast({
				kind: 'recurring',
				recurrence: { period: 'week' }
			});
			const status = computeStatus(task, now);
			expect(status.visible).toBe(true);
		});

		it('daily, mid-day → 1 day left → due today', () => {
			const task = withLast({
				kind: 'recurring',
				recurrence: { period: 'day' }
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('due');
			expect(status.label).toBe('due today');
		});
	});

	describe('cadence', () => {
		it('never done → overdue', () => {
			const task = withLast({
				kind: 'cadence',
				cadence: { targetIntervalDays: 30 }
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('overdue');
			expect(status.label).toBe('never done');
			expect(status.overdueDays).toBe(30);
		});

		it('done today, target 30 → fresh', () => {
			const task = withLast({
				kind: 'cadence',
				cadence: { targetIntervalDays: 30 },
				lastCompletedAt: now.toISOString()
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('fresh');
		});

		it('done 25 days ago, target 30 → due (>= 80%)', () => {
			const lastAt = new Date(now.getTime() - 25 * 86_400_000).toISOString();
			const task = withLast({
				kind: 'cadence',
				cadence: { targetIntervalDays: 30 },
				lastCompletedAt: lastAt
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('due');
		});

		it('done 22 days ago, target 30 → soon (>= 70%)', () => {
			const lastAt = new Date(now.getTime() - 22 * 86_400_000).toISOString();
			const task = withLast({
				kind: 'cadence',
				cadence: { targetIntervalDays: 30 },
				lastCompletedAt: lastAt
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('soon');
		});

		it('done 18 days ago, target 30 → fresh (60% — under 70% soon threshold)', () => {
			const lastAt = new Date(now.getTime() - 18 * 86_400_000).toISOString();
			const task = withLast({
				kind: 'cadence',
				cadence: { targetIntervalDays: 30 },
				lastCompletedAt: lastAt
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('fresh');
		});

		it('done 40 days ago, target 30 → overdue with positive overdueDays', () => {
			const lastAt = new Date(now.getTime() - 40 * 86_400_000).toISOString();
			const task = withLast({
				kind: 'cadence',
				cadence: { targetIntervalDays: 30 },
				lastCompletedAt: lastAt
			});
			const status = computeStatus(task, now);
			expect(status.urgency).toBe('overdue');
			expect(status.overdueDays).toBe(10);
		});
	});
});
