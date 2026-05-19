import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'static/icons/icon.svg');
const outDir = join(root, 'static/icons');

const targets = [
	{ name: 'icon-192.png', size: 192, padding: 0 },
	{ name: 'icon-512.png', size: 512, padding: 0 },
	{ name: 'icon-maskable-512.png', size: 512, padding: 0.15 }
];

if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
const svg = await readFile(src);

for (const t of targets) {
	const inner = Math.round(t.size * (1 - t.padding * 2));
	const offset = Math.round(t.size * t.padding);
	const rendered = await sharp(svg, { density: 600 })
		.resize(inner, inner)
		.png()
		.toBuffer();
	const canvas = sharp({
		create: {
			width: t.size,
			height: t.size,
			channels: 4,
			background: '#1c1917'
		}
	})
		.composite([{ input: rendered, top: offset, left: offset }])
		.png();
	const out = await canvas.toBuffer();
	await writeFile(join(outDir, t.name), out);
	console.log(`wrote ${t.name}`);
}
