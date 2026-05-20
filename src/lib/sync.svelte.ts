import type { Task, Completion } from './types';
import { db } from './db';
import { getSupabase } from './supabase';
import { authState } from './auth.svelte';
import { reloadTasks } from './store.svelte';
import type { RealtimeChannel } from '@supabase/supabase-js';

const LAST_SYNC_KEY = 'ppo:lastSyncAt';

interface TaskRow {
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

interface CompletionRow {
	id: string;
	user_id: string;
	task_id: string;
	at: string;
	updated_at: string;
	deleted_at: string | null;
}

function taskToRow(task: Task, userId: string): TaskRow {
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

function rowToTask(row: TaskRow): Task {
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

function completionToRow(c: Completion, userId: string): CompletionRow {
	return {
		id: c.id,
		user_id: userId,
		task_id: c.taskId,
		at: c.at,
		updated_at: c.updatedAt,
		deleted_at: c.deletedAt ?? null
	};
}

function rowToCompletion(row: CompletionRow): Completion {
	return {
		id: row.id,
		taskId: row.task_id,
		at: row.at,
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at ?? undefined
	};
}

interface SyncStatus {
	enabled: boolean;
	state: 'idle' | 'syncing' | 'error';
	lastSyncedAt: string | null;
	error: string | null;
	pendingCount: number;
}

export const syncStatus: SyncStatus = $state({
	enabled: false,
	state: 'idle',
	lastSyncedAt: null,
	error: null,
	pendingCount: 0
});

function outboxId(table: 'tasks' | 'completions', rowId: string): string {
	return `${table}:${rowId}`;
}

async function refreshPendingCount(): Promise<void> {
	syncStatus.pendingCount = await db.outbox.count();
}

export async function enqueuePush(
	table: 'tasks' | 'completions',
	rowId: string
): Promise<void> {
	const sb = getSupabase();
	if (!sb || !authState.user) return;
	await db.outbox.put({
		id: outboxId(table, rowId),
		table,
		rowId,
		queuedAt: new Date().toISOString()
	});
	await refreshPendingCount();
	void drainOutbox();
}

let draining = false;
export async function drainOutbox(): Promise<void> {
	const sb = getSupabase();
	if (!sb || !authState.user) return;
	if (draining) return;
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
	draining = true;
	try {
		const userId = authState.user.id;
		while (true) {
			const entries = await db.outbox.orderBy('queuedAt').limit(50).toArray();
			if (entries.length === 0) break;
			let failed = false;
			for (const entry of entries) {
				try {
					if (entry.table === 'tasks') {
						const row = await db.tasks.get(entry.rowId);
						if (!row) {
							await db.outbox.delete(entry.id);
							continue;
						}
						const { error } = await sb.from('tasks').upsert(taskToRow(row, userId));
						if (error) throw error;
					} else {
						const row = await db.completions.get(entry.rowId);
						if (!row) {
							await db.outbox.delete(entry.id);
							continue;
						}
						const { error } = await sb
							.from('completions')
							.upsert(completionToRow(row, userId));
						if (error) throw error;
					}
					await db.outbox.delete(entry.id);
				} catch (e) {
					console.warn('outbox drain failed for', entry.id, e);
					failed = true;
					break;
				}
			}
			if (failed) break;
		}
	} finally {
		draining = false;
		await refreshPendingCount();
	}
}

export async function fullSync(): Promise<void> {
	const sb = getSupabase();
	if (!sb || !authState.user) {
		syncStatus.enabled = false;
		return;
	}
	if (syncStatus.state === 'syncing') return;

	syncStatus.enabled = true;
	syncStatus.state = 'syncing';
	syncStatus.error = null;
	const userId = authState.user.id;

	try {
		// 1. Push everything local — idempotent upsert. Covers rows created before
		//    sign-in (which never got into the outbox).
		const localTasks = await db.tasks.toArray();
		const localCompletions = await db.completions.toArray();

		if (localTasks.length > 0) {
			const { error } = await sb
				.from('tasks')
				.upsert(localTasks.map((t) => taskToRow(t, userId)));
			if (error) throw error;
		}
		if (localCompletions.length > 0) {
			const { error } = await sb
				.from('completions')
				.upsert(localCompletions.map((c) => completionToRow(c, userId)));
			if (error) throw error;
		}
		await db.outbox.clear();

		// 2. Pull everything from server.
		const { data: taskRows, error: te } = await sb.from('tasks').select('*');
		if (te) throw te;
		const { data: completionRows, error: ce } = await sb.from('completions').select('*');
		if (ce) throw ce;

		// 3. Merge into local. Last-write-wins on updatedAt.
		await db.transaction('rw', db.tasks, db.completions, async () => {
			for (const r of (taskRows ?? []) as TaskRow[]) {
				const remote = rowToTask(r);
				const local = await db.tasks.get(remote.id);
				if (!local || remote.updatedAt >= local.updatedAt) {
					await db.tasks.put(remote);
				}
			}
			for (const r of (completionRows ?? []) as CompletionRow[]) {
				const remote = rowToCompletion(r);
				const local = await db.completions.get(remote.id);
				if (!local || remote.updatedAt >= local.updatedAt) {
					await db.completions.put(remote);
				}
			}
		});

		const now = new Date().toISOString();
		try {
			localStorage.setItem(LAST_SYNC_KEY, now);
		} catch {
			// ignore quota/private-mode errors
		}
		syncStatus.lastSyncedAt = now;
		syncStatus.state = 'idle';
		await refreshPendingCount();

		await reloadTasks();
	} catch (e) {
		syncStatus.state = 'error';
		syncStatus.error = e instanceof Error ? e.message : String(e);
		console.error('fullSync failed', e);
	}
}

let realtimeChannel: RealtimeChannel | null = null;
let reloadDebounce: ReturnType<typeof setTimeout> | null = null;

function scheduleReload(): void {
	if (reloadDebounce) clearTimeout(reloadDebounce);
	reloadDebounce = setTimeout(() => {
		reloadDebounce = null;
		void reloadTasks();
	}, 150);
}

export function subscribeRealtime(): void {
	const sb = getSupabase();
	if (!sb || !authState.user) return;
	if (realtimeChannel) return;
	const userId = authState.user.id;
	const filter = `user_id=eq.${userId}`;
	realtimeChannel = sb
		.channel(`ppo:${userId}`)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'tasks', filter },
			async (payload) => {
				const next = payload.new as Partial<TaskRow> | undefined;
				if (!next || !next.id) return;
				const remote = rowToTask(next as TaskRow);
				const local = await db.tasks.get(remote.id);
				if (!local || remote.updatedAt > local.updatedAt) {
					await db.tasks.put(remote);
					scheduleReload();
				}
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'completions', filter },
			async (payload) => {
				const next = payload.new as Partial<CompletionRow> | undefined;
				if (!next || !next.id) return;
				const remote = rowToCompletion(next as CompletionRow);
				const local = await db.completions.get(remote.id);
				if (!local || remote.updatedAt > local.updatedAt) {
					await db.completions.put(remote);
					scheduleReload();
				}
			}
		)
		.subscribe();
}

export async function unsubscribeRealtime(): Promise<void> {
	if (!realtimeChannel) return;
	const sb = getSupabase();
	const channel = realtimeChannel;
	realtimeChannel = null;
	if (sb) await sb.removeChannel(channel);
}

export async function clearLocalData(): Promise<void> {
	await db.transaction('rw', db.tasks, db.completions, db.outbox, async () => {
		await db.tasks.clear();
		await db.completions.clear();
		await db.outbox.clear();
	});
	syncStatus.pendingCount = 0;
	syncStatus.lastSyncedAt = null;
	syncStatus.state = 'idle';
	syncStatus.error = null;
	try {
		localStorage.removeItem(LAST_SYNC_KEY);
	} catch {
		// ignore
	}
	await reloadTasks();
}

export function loadLastSyncedAt(): void {
	try {
		syncStatus.lastSyncedAt = localStorage.getItem(LAST_SYNC_KEY);
	} catch {
		// ignore
	}
	void refreshPendingCount();
}
