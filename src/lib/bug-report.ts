import { domToBlob } from 'modern-screenshot';
import { getSupabase } from './supabase';

export interface BugReportResult {
	issueUrl: string;
	issueNumber: number;
}

// Snapshot the current page. Caller is responsible for closing any open
// modals/menus *before* invoking this — anything in the DOM is captured.
// Returns null if the screenshot library throws (rare CSS edge cases);
// the report can still be submitted without an image.
export async function captureScreenshot(): Promise<Blob | null> {
	try {
		return await domToBlob(document.documentElement, {
			scale: window.devicePixelRatio > 1 ? 1.5 : 1,
			// modern-screenshot ignores elements with [data-no-screenshot].
			filter: (el) => !(el instanceof HTMLElement && el.dataset.noScreenshot !== undefined)
		});
	} catch (e) {
		console.warn('bug-report: screenshot failed', e);
		return null;
	}
}

async function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const r = reader.result;
			if (typeof r !== 'string') return reject(new Error('FileReader returned non-string'));
			// strip "data:image/png;base64," prefix
			const comma = r.indexOf(',');
			resolve(comma >= 0 ? r.slice(comma + 1) : r);
		};
		reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
		reader.readAsDataURL(blob);
	});
}

export async function submitBugReport(args: {
	description: string;
	screenshot: Blob | null;
}): Promise<BugReportResult> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('Not connected to Supabase. Sign in first.');

	const screenshotBase64 = args.screenshot ? await blobToBase64(args.screenshot) : null;

	const { data, error } = await supabase.functions.invoke('report-bug', {
		body: {
			description: args.description,
			screenshotBase64,
			url: typeof window !== 'undefined' ? window.location.href : undefined,
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
		}
	});

	if (error) throw error;
	if (!data?.issueUrl) throw new Error('Function returned no issue URL');
	return data as BugReportResult;
}
