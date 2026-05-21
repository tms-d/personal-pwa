import type { Task, TaskWithLast, Period, CompletionStream } from './types';
import { db, uid } from './db';
import { enqueuePush } from './sync.svelte';

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

export type Urgency = 'fresh' | 'soon' | 'due' | 'overdue';

export interface ComputedStatus {
	visible: boolean;
	overdueDays: number;
	urgency: Urgency;
	label: string;
	// Set only for kind: 'friend' — one row of status per stream so the
	// card can render both side by side. The outer `urgency` is the worst
	// of the two streams.
	streams?: { contacted: ComputedStreamStatus; seen: ComputedStreamStatus };
}

export interface ComputedStreamStatus {
	overdueDays: number;
	urgency: Urgency;
	label: string;
}

function cadenceStatus(
	targetDays: number,
	lastAt: string | null | undefined,
	now: Date
): ComputedStreamStatus {
	const since = daysSince(lastAt ?? null, now);
	if (since === null) {
		return { overdueDays: targetDays, urgency: 'overdue', label: 'never' };
	}
	const overdueDays = since - targetDays;
	const urgency: Urgency =
		overdueDays > 0
			? 'overdue'
			: since >= targetDays * 0.8
				? 'due'
				: since >= targetDays * 0.5
					? 'soon'
					: 'fresh';
	return { overdueDays, urgency, label: `${since}d ago · target ${targetDays}d` };
}

const URGENCY_RANK: Record<Urgency, number> = { fresh: 0, soon: 1, due: 2, overdue: 3 };

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
		const s = cadenceStatus(task.cadence.targetIntervalDays, task.lastCompletedAt, now);
		// Translate `never` → `never done` for parity with the prior wording.
		const label = s.label === 'never' ? 'never done' : s.label;
		return { visible: true, overdueDays: s.overdueDays, urgency: s.urgency, label };
	}

	if (task.kind === 'friend') {
		const contactedTarget = task.contactedTargetDays ?? 30;
		const seenTarget = task.seenTargetDays ?? 90;
		const contacted = cadenceStatus(contactedTarget, task.lastContactedAt, now);
		const seen = cadenceStatus(seenTarget, task.lastSeenAt, now);
		const urgency: Urgency =
			URGENCY_RANK[contacted.urgency] >= URGENCY_RANK[seen.urgency]
				? contacted.urgency
				: seen.urgency;
		const overdueDays = Math.max(contacted.overdueDays, seen.overdueDays);
		return {
			visible: true,
			overdueDays,
			urgency,
			label: '',
			streams: { contacted, seen }
		};
	}

	return { visible: true, overdueDays: 0, urgency: 'fresh', label: '' };
}

export async function loadTasksWithLast(): Promise<TaskWithLast[]> {
	const tasks = await db.tasks.toArray();
	const completions = await db.completions.toArray();
	// For non-friend tasks we track the latest completion regardless of stream
	// (and existing completions have no stream). For friend tasks we track
	// the latest per (contacted|seen) stream.
	const lastByTask = new Map<string, string>();
	const lastContactedByTask = new Map<string, string>();
	const lastSeenByTask = new Map<string, string>();
	for (const c of completions) {
		if (c.deletedAt) continue;
		if (c.stream === 'contacted') {
			const cur = lastContactedByTask.get(c.taskId);
			if (!cur || c.at > cur) lastContactedByTask.set(c.taskId, c.at);
		} else if (c.stream === 'seen') {
			const cur = lastSeenByTask.get(c.taskId);
			if (!cur || c.at > cur) lastSeenByTask.set(c.taskId, c.at);
		} else {
			const cur = lastByTask.get(c.taskId);
			if (!cur || c.at > cur) lastByTask.set(c.taskId, c.at);
		}
	}
	return tasks
		.filter((t) => !t.deletedAt)
		.map((t) => {
			if (t.kind === 'friend') {
				return {
					...t,
					lastCompletedAt: null,
					lastContactedAt: lastContactedByTask.get(t.id) ?? null,
					lastSeenAt: lastSeenByTask.get(t.id) ?? null
				};
			}
			return { ...t, lastCompletedAt: lastByTask.get(t.id) ?? null };
		});
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
	void enqueuePush('tasks', task.id);
	return task;
}

export async function updateTask(
	id: string,
	patch: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Task | null> {
	const existing = await db.tasks.get(id);
	if (!existing) return null;
	const updated: Task = {
		...existing,
		...patch,
		id: existing.id,
		createdAt: existing.createdAt,
		updatedAt: new Date().toISOString()
	};
	await db.tasks.put(updated);
	void enqueuePush('tasks', updated.id);
	return updated;
}

export async function completeTask(
	taskId: string,
	at: Date = new Date(),
	stream?: CompletionStream
): Promise<void> {
	const now = new Date().toISOString();
	const completion = {
		id: uid(),
		taskId,
		at: at.toISOString(),
		updatedAt: now,
		...(stream ? { stream } : {})
	};
	await db.completions.add(completion);
	void enqueuePush('completions', completion.id);
}

export async function uncompleteTask(
	taskId: string,
	stream?: CompletionStream
): Promise<void> {
	const completions = await db.completions
		.where('taskId')
		.equals(taskId)
		.filter((c) => !c.deletedAt && (stream === undefined || c.stream === stream))
		.toArray();
	if (completions.length === 0) return;
	completions.sort((a, b) => (a.at < b.at ? 1 : -1));
	const target = completions[0];
	const now = new Date().toISOString();
	const updated = { ...target, deletedAt: now, updatedAt: now };
	await db.completions.put(updated);
	void enqueuePush('completions', updated.id);
}

export async function deleteTask(taskId: string): Promise<void> {
	const now = new Date().toISOString();
	const task = await db.tasks.get(taskId);
	if (!task) return;
	const updatedTask = { ...task, deletedAt: now, updatedAt: now };
	await db.tasks.put(updatedTask);
	void enqueuePush('tasks', updatedTask.id);

	const completions = await db.completions
		.where('taskId')
		.equals(taskId)
		.filter((c) => !c.deletedAt)
		.toArray();
	for (const c of completions) {
		const updated = { ...c, deletedAt: now, updatedAt: now };
		await db.completions.put(updated);
		void enqueuePush('completions', updated.id);
	}
}
