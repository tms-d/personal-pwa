// Supabase Edge Function: report-bug
//
// Verifies the caller's Supabase JWT, uploads the (optional) screenshot
// PNG to the `bug-reports` Storage bucket using the service-role key,
// then opens an issue on the GitHub repo via a fine-grained PAT stored
// as a function secret. Returns { issueUrl }.
//
// Required function secrets (set via Supabase dashboard or `supabase
// secrets set`):
//   - GITHUB_PAT          fine-grained PAT, scoped to tms-d/personal-pwa,
//                         "Issues: write" permission
//   - GITHUB_REPO         "owner/repo", e.g. "tms-d/personal-pwa"
// Provided automatically by the Supabase runtime:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SUPABASE_ANON_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RequestBody {
	description: string;
	url?: string;
	userAgent?: string;
	screenshotBase64?: string | null;
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

function base64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
	if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return json({ error: 'missing bearer token' }, 401);
	}
	const jwt = authHeader.slice('Bearer '.length);

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const ghToken = Deno.env.get('GITHUB_PAT');
	const ghRepo = Deno.env.get('GITHUB_REPO');
	if (!supabaseUrl || !serviceKey || !ghToken || !ghRepo) {
		return json({ error: 'function not configured' }, 500);
	}

	const admin = createClient(supabaseUrl, serviceKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
	if (userErr || !userData?.user) return json({ error: 'invalid session' }, 401);
	const user = userData.user;

	let body: RequestBody;
	try {
		body = await req.json();
	} catch {
		return json({ error: 'invalid json' }, 400);
	}

	const description = (body.description ?? '').trim();
	if (!description) return json({ error: 'description required' }, 400);
	if (description.length > 5000) return json({ error: 'description too long' }, 400);

	let screenshotUrl: string | null = null;
	if (body.screenshotBase64) {
		if (body.screenshotBase64.length > 5_000_000) {
			return json({ error: 'screenshot too large' }, 400);
		}
		const bytes = base64ToBytes(body.screenshotBase64);
		const path = `${user.id}/${Date.now()}.png`;
		const { error: uploadErr } = await admin.storage
			.from('bug-reports')
			.upload(path, bytes, { contentType: 'image/png', upsert: false });
		if (uploadErr) {
			console.error('storage upload failed', uploadErr);
			return json({ error: 'screenshot upload failed' }, 500);
		}
		const { data: pub } = admin.storage.from('bug-reports').getPublicUrl(path);
		screenshotUrl = pub.publicUrl;
	}

	const firstLine = description.split('\n')[0].trim();
	const title = firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;

	const lines: string[] = [
		'## Description',
		'',
		description,
		'',
		'## Context',
		'',
		`- **URL:** ${body.url ?? '(unknown)'}`,
		`- **User-agent:** ${body.userAgent ?? '(unknown)'}`,
		`- **Reporter:** ${user.email ?? user.id}`,
		`- **Filed:** ${new Date().toISOString()}`
	];
	if (screenshotUrl) {
		lines.push('', '## Screenshot', '', `![screenshot](${screenshotUrl})`);
	}
	lines.push('', '---', '_Filed from the in-app bug-report dialog._');
	const issueBody = lines.join('\n');

	const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${ghToken}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'snail-bug-reporter'
		},
		body: JSON.stringify({
			title: title || 'Bug report',
			body: issueBody,
			labels: ['bug', 'user-reported']
		})
	});

	if (!ghRes.ok) {
		const text = await ghRes.text();
		console.error('github error', ghRes.status, text);
		return json({ error: 'github rejected the issue', detail: text }, 502);
	}

	const issue = await ghRes.json();
	return json({ issueUrl: issue.html_url, issueNumber: issue.number });
});
