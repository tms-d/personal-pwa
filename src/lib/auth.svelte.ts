import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

interface AuthState {
	loading: boolean;
	configured: boolean;
	user: User | null;
	session: Session | null;
}

export const authState: AuthState = $state({
	loading: true,
	configured: false,
	user: null,
	session: null
});

type AuthChangeHandler = (user: User | null) => void | Promise<void>;
const changeHandlers = new Set<AuthChangeHandler>();

export function onAuthChange(handler: AuthChangeHandler): () => void {
	changeHandlers.add(handler);
	return () => changeHandlers.delete(handler);
}

function fire(user: User | null) {
	for (const h of changeHandlers) {
		void h(user);
	}
}

export async function initAuth(): Promise<void> {
	const sb = getSupabase();
	if (!sb) {
		authState.loading = false;
		authState.configured = false;
		return;
	}
	authState.configured = true;

	const {
		data: { session }
	} = await sb.auth.getSession();
	authState.session = session;
	authState.user = session?.user ?? null;
	authState.loading = false;
	fire(authState.user);

	sb.auth.onAuthStateChange((_event, newSession) => {
		const prevUserId = authState.user?.id ?? null;
		authState.session = newSession;
		authState.user = newSession?.user ?? null;
		const newUserId = authState.user?.id ?? null;
		if (prevUserId !== newUserId) fire(authState.user);
	});
}

export async function signInWithGitHub(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	await sb.auth.signInWithOAuth({
		provider: 'github',
		options: {
			redirectTo: window.location.origin + '/'
		}
	});
}

export async function signOut(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	await sb.auth.signOut();
}
