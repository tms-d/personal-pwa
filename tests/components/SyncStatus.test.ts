import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

const authStub: {
	user: { id: string } | null;
	configured: boolean;
	loading: boolean;
} = { user: null, configured: true, loading: false };
const syncStub = {
	enabled: false,
	state: 'idle' as 'idle' | 'syncing' | 'error',
	lastSyncedAt: null as string | null,
	error: null as string | null,
	pendingCount: 0
};
const fullSync = vi.fn();
const signInWithGitHub = vi.fn();

vi.mock('$lib/sync.svelte', () => ({ syncStatus: syncStub, fullSync }));
vi.mock('$lib/auth.svelte', () => ({ authState: authStub, signInWithGitHub }));

const SyncStatus = (await import('$lib/components/SyncStatus.svelte')).default;

beforeEach(() => {
	authStub.user = null;
	authStub.configured = true;
	authStub.loading = false;
	syncStub.state = 'idle';
	syncStub.lastSyncedAt = null;
	syncStub.error = null;
	syncStub.pendingCount = 0;
	fullSync.mockReset();
	signInWithGitHub.mockReset();
});

describe('SyncStatus', () => {
	it('signed out: shows "Local only · Sign in"', () => {
		authStub.user = null;
		render(SyncStatus);
		expect(screen.getByRole('button')).toHaveTextContent(/Local only.*Sign in/);
	});

	it('signed out: clicking the pill calls signInWithGitHub', async () => {
		authStub.user = null;
		render(SyncStatus);
		await userEvent.click(screen.getByRole('button'));
		expect(signInWithGitHub).toHaveBeenCalledOnce();
	});

	it('signed in idle: shows time-stamp of last sync', () => {
		authStub.user = { id: 'u' };
		syncStub.lastSyncedAt = '2026-05-20T10:00:00.000Z';
		render(SyncStatus);
		expect(screen.getByRole('button')).toHaveTextContent(/Synced/);
	});

	it('signed in syncing: shows "Syncing…"', () => {
		authStub.user = { id: 'u' };
		syncStub.state = 'syncing';
		render(SyncStatus);
		expect(screen.getByRole('button')).toHaveTextContent('Syncing…');
	});

	it('signed in error: shows "Sync error" with error message in title', () => {
		authStub.user = { id: 'u' };
		syncStub.state = 'error';
		syncStub.error = 'boom';
		render(SyncStatus);
		const btn = screen.getByRole('button');
		expect(btn).toHaveTextContent('Sync error');
		expect(btn).toHaveAttribute('title', 'boom');
	});

	it('signed in with pending: shows pending count', () => {
		authStub.user = { id: 'u' };
		syncStub.pendingCount = 3;
		render(SyncStatus);
		expect(screen.getByRole('button')).toHaveTextContent('3 pending');
	});

	it('signed in idle: clicking pill triggers fullSync', async () => {
		authStub.user = { id: 'u' };
		render(SyncStatus);
		await userEvent.click(screen.getByRole('button'));
		expect(fullSync).toHaveBeenCalledOnce();
	});

	it('never synced and signed in: shows "Not synced yet"', () => {
		authStub.user = { id: 'u' };
		render(SyncStatus);
		expect(screen.getByRole('button')).toHaveTextContent('Not synced yet');
	});
});
