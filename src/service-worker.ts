/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `ppo-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
		)
	);
	sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return;
	event.respondWith(
		(async () => {
			if (ASSETS.includes(url.pathname)) {
				const cached = await caches.match(req);
				if (cached) return cached;
			}
			try {
				const fresh = await fetch(req);
				return fresh;
			} catch {
				const cached = await caches.match(req);
				if (cached) return cached;
				throw new Error('offline and no cache');
			}
		})()
	);
});

export {};
