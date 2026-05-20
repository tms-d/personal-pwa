import { db } from './db';
import { getSupabase } from './supabase';
import { authState } from './auth.svelte';
import { reloadTasks } from './store.svelte';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
	taskToRow,
	rowToTask,
	completionToRow,
	rowToCompletion,
	isRemoteNewer,
	outboxId,
	type TaskRow,
	type CompletionRow
} from './sync-helpers';

const LAST_SYNC_KEY = 'ppo:lastSyncAt';

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

let drainInFlight: Promise<void> | null = null;
export function drainOutbox(): Promise<void> {
	if (drainInFlight) return drainInFlight;
	const sb = getSupabase();
	if (!sb || !authState.user) return Promise.resolve();
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		return Promise.resolve();
	}
	const userId = authState.user.id;
	drainInFlight = (async () => {
		try {
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
			await refreshPendingCount();
			drainInFlight = null;
		}
	})();
	return drainInFlight;
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

		// 3. Merge into local. Last-write-wins on updatedAt (non-strict so equal
		//    timestamps still re-put — harmless and keeps merge symmetric).
		await db.transaction('rw', db.tasks, db.completions, async () => {
			for (const r of (taskRows ?? []) as TaskRow[]) {
				const remote = rowToTask(r);
				const local = await db.tasks.get(remote.id);
				if (isRemoteNewer(local?.updatedAt, remote.updatedAt, false)) {
					await db.tasks.put(remote);
				}
			}
			for (const r of (completionRows ?? []) as CompletionRow[]) {
				const remote = rowToCompletion(r);
				const local = await db.completions.get(remote.id);
				if (isRemoteNewer(local?.updatedAt, remote.updatedAt, false)) {
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
				if (isRemoteNewer(local?.updatedAt, remote.updatedAt, true)) {
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
				if (isRemoteNewer(local?.updatedAt, remote.updatedAt, true)) {
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
