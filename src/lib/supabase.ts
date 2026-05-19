import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
	if (client) return client;
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) return null;
	client = createClient(url, key);
	return client;
}
