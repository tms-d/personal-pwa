import type { Task, TaskWithLast, Period } from './types';
import { db, uid } from './db';
import { pushTask, pushCompletion } from './sync.svelte';

const MS_PER_DAY = 86_400_000;

export function periodStart(period: Period, now = new Date()): Date {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	switch (period) {
		case 'day':
			return d;
		case 'week': {
			const dow = (d.getDay() + 6) % 7; // Monday-indexed
			d.setDate(d.getDate() - dow);
			return d;
		}
		case 'month':
			d.setDate(1);
			return d;
		case 'year':
			d.setMonth(0, 1);
			return d;
	}
}

export function periodEnd(period: Period, now = new Date()): Date {
	const start = periodStart(period, now);
	const end = new Date(start);
	switch (period) {
		case 'day':
			end.setDate(end.getDate() + 1);
			break;
		case 'week':
			end.setDate(end.getDate() + 7);
			break;
		case 'month':
			end.setMonth(end.getMonth() + 1);
			break;
		case 'year':
			end.setFullYear(end.getFullYear() + 1);
			break;
	}
	return end;
}

export function daysSince(iso: string | null, now = new Date()): number | null {
	if (!iso) return null;
	const then = new Date(iso).getTime();
	return Math.floor((now.getTime() - then) / MS_PER_DAY);
}

export interface ComputedStatus {
	visible: boolean;
	overdueDays: number;
	urgency: 'fresh' | 'soon' | 'due' | 'overdue';
	label: string;
}

export function computeStatus(task: TaskWithLast, now = new Date()): ComputedStatus {
	if (task.archivedAt) {
		return { visible: false, overdueDays: 0, urgency: 'fresh', label: 'Archived' };
	}

	if (task.kind === 'todo') {
		const done = !!task.lastCompletedAt;
		return {
			visible: !done,
			overdueDays: 0,
			urgency: done ? 'fresh' : 'due',
			label: done ? 'Done' : 'Todo'
		};
	}

	if (task.kind === 'recurring' && task.recurrence) {
		const start = periodStart(task.recurrence.period, now);
		const end = periodEnd(task.recurrence.period, now);
		const last = task.lastCompletedAt ? new Date(task.lastCompletedAt) : null;
		const doneThisPeriod = last !== null && last >= start;
		if (doneThisPeriod) {
			return {
				visible: false,
				overdueDays: 0,
				urgency: 'fresh',
				label: 'Done this ' + task.recurrence.period
			};
		}
		const msLeft = end.getTime() - now.getTime();
		const daysLeft = Math.ceil(msLeft / MS_PER_DAY);
		const urgency: ComputedStatus['urgency'] =
			daysLeft <= 1 ? 'due' : daysLeft <= 3 ? 'soon' : 'fresh';
		return {
			visible: true,
			overdueDays: 0,
			urgency,
			label: daysLeft === 1 ? 'due today' : `${daysLeft} days left`
		};
	}

	if (task.kind === 'cadence' && task.cadence) {
		const target = task.cadence.targetIntervalDays;
		const since = daysSince(task.lastCompletedAt, now);
		if (since === null) {
			return { visible: true, overdueDays: target, urgency: 'overdue', label: 'never done' };
		}
		const overdueDays = since - target;
		const urgency: ComputedStatus['urgency'] =
			overdueDays > 0
				? 'overdue'
				: since >= target * 0.8
					? 'due'
					: since >= target * 0.5
						? 'soon'
						: 'fresh';
		return {
			visible: true,
			overdueDays,
			urgency,
			label: `${since}d ago · target ${target}d`
		};
	}

	return { visible: true, overdueDays: 0, urgency: 'fresh', label: '' };
}

export async function loadTasksWithLast(): Promise<TaskWithLast[]> {
	const tasks = await db.tasks.toArray();
	const completions = await db.completions.toArray();
	const lastByTask = new Map<string, string>();
	for (const c of completions) {
		if (c.deletedAt) continue;
		const cur = lastByTask.get(c.taskId);
		if (!cur || c.at > cur) lastByTask.set(c.taskId, c.at);
	}
	return tasks
		.filter((t) => !t.deletedAt)
		.map((t) => ({ ...t, lastCompletedAt: lastByTask.get(t.id) ?? null }));
}

export async function createTask(
	input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Task> {
	const now = new Date().toISOString();
	const task: Task = {
		...input,
		id: uid(),
		createdAt: now,
		updatedAt: now
	};
	await db.tasks.add(task);
	void pushTask(task);
	return task;
}

export async function completeTask(taskId: string, at = new Date()): Promise<void> {
	const now = new Date().toISOString();
	const completion = {
		id: uid(),
		taskId,
		at: at.toISOString(),
		updatedAt: now
	};
	await db.completions.add(completion);
	void pushCompletion(completion);
}

export async function uncompleteTask(taskId: string): Promise<void> {
	const completions = await db.completions
		.where('taskId')
		.equals(taskId)
		.filter((c) => !c.deletedAt)
		.toArray();
	if (completions.length === 0) return;
	completions.sort((a, b) => (a.at < b.at ? 1 : -1));
	const target = completions[0];
	const now = new Date().toISOString();
	const updated = { ...target, deletedAt: now, updatedAt: now };
	await db.completions.put(updated);
	void pushCompletion(updated);
}

export async function deleteTask(taskId: string): Promise<void> {
	const now = new Date().toISOString();
	const task = await db.tasks.get(taskId);
	if (!task) return;
	const updatedTask = { ...task, deletedAt: now, updatedAt: now };
	await db.tasks.put(updatedTask);
	void pushTask(updatedTask);

	const completions = await db.completions
		.where('taskId')
		.equals(taskId)
		.filter((c) => !c.deletedAt)
		.toArray();
	for (const c of completions) {
		const updated = { ...c, deletedAt: now, updatedAt: now };
		await db.completions.put(updated);
		void pushCompletion(updated);
	}
}
