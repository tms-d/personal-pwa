import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read at build time. Vite inlines import.meta.env.PUBLIC_* when SvelteKit's
// envPrefix includes PUBLIC_ (the default). Values reach the browser on
// adapter-static — unlike $env/dynamic/public, which needs SSR to populate.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
	if (client) return client;
	if (!SUPABASE_URL || !SUPABASE_KEY) return null;
	client = createClient(SUPABASE_URL, SUPABASE_KEY);
	return client;
}
