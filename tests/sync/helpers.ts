import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { BrowserContext } from '@playwright/test';

interface SyncTestConfig {
	supabaseUrl: string;
	publishableKey: string;
	email: string;
	password: string;
}

export function getSyncConfig(): SyncTestConfig | null {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	const email = process.env.TEST_USER_EMAIL;
	const password = process.env.TEST_USER_PASSWORD;
	if (!supabaseUrl || !publishableKey || !email || !password) return null;
	return { supabaseUrl, publishableKey, email, password };
}

export function projectRef(supabaseUrl: string): string {
	// https://abcde.supabase.co → abcde
	const host = new URL(supabaseUrl).host;
	return host.split('.')[0];
}

export function storageKey(supabaseUrl: string): string {
	return `sb-${projectRef(supabaseUrl)}-auth-token`;
}

export async function signedInClient(config: SyncTestConfig): Promise<{
	client: SupabaseClient;
	session: Session;
}> {
	const client = createClient(config.supabaseUrl, config.publishableKey);
	const { data, error } = await client.auth.signInWithPassword({
		email: config.email,
		password: config.password
	});
	if (error) throw error;
	if (!data.session) throw new Error('signInWithPassword returned no session');
	return { client, session: data.session };
}

export async function seedSession(
	context: BrowserContext,
	supabaseUrl: string,
	session: Session
): Promise<void> {
	const key = storageKey(supabaseUrl);
	const value = JSON.stringify(session);
	await context.addInitScript(
		([k, v]) => {
			try {
				window.localStorage.setItem(k, v);
			} catch {
				// ignore
			}
		},
		[key, value] as const
	);
}

export async function wipeUserRows(client: SupabaseClient): Promise<void> {
	// RLS scopes both deletes to the signed-in user.
	await client.from('completions').delete().neq('id', '');
	await client.from('tasks').delete().neq('id', '');
}
