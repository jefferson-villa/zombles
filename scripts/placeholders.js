#!/usr/bin/env node
// Generate one solid-color PLACEHOLDER image per map so the game runs before
// any screenshots have been fetched. `npm run promote` replaces them.
//
//   npm run placeholders

import fs from 'node:fs/promises';
import path from 'node:path';
import { MAPS, GAME_NAMES } from '../shared/maps.js';
import { imageId, answerToken } from '../shared/hash.js';
import { MAPS_DIR, readManifest, writeManifest, pruneMapsDir } from './lib.js';

const W = 1600;
const H = 900;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svgFor(map) {
  const label = esc(map.name);
  // Grid + corner labels give the zoom steps something to reveal.
  const grid = [];
  for (let x = 100; x < W; x += 100) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
  for (let y = 100; y < H; y += 100) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${map.color}"/>
  <g stroke="#ffffff" stroke-opacity="0.12" stroke-width="2">${grid.join('')}</g>
  <circle cx="${W / 2}" cy="${H / 2}" r="330" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="10"/>
  <g font-family="Impact, 'Arial Black', sans-serif" fill="#fff" text-anchor="middle">
    <text x="${W / 2}" y="${H / 2 + 50}" font-size="150">${label}</text>
    <text x="${W / 2}" y="${H / 2 + 140}" font-size="56" fill-opacity="0.75">${esc(GAME_NAMES[map.game])}</text>
  </g>
  <g font-family="monospace" font-size="40" fill="#fff" fill-opacity="0.8">
    <text x="40" y="70">PLACEHOLDER — run npm run fetch &amp;&amp; npm run promote</text>
    <text x="40" y="${H - 40}">SW</text>
    <text x="${W - 40}" y="${H - 40}" text-anchor="end">SE</text>
    <text x="${W - 40}" y="70" text-anchor="end">NE</text>
  </g>
</svg>
`;
}

async function main() {
  const existing = await readManifest();
  const real = existing.filter((e) => !e.placeholder);
  if (real.length && !process.argv.includes('--force')) {
    console.error(`manifest.json already has ${real.length} real images; refusing to add placeholders (use --force).`);
    process.exit(1);
  }
  await fs.mkdir(MAPS_DIR, { recursive: true });
  const entries = [];
  for (const map of MAPS) {
    const bytes = new TextEncoder().encode(svgFor(map));
    const id = imageId(bytes);
    const file = `${id}.svg`;
    await fs.writeFile(path.join(MAPS_DIR, file), bytes);
    entries.push({ id, file, slug: answerToken(id, map.slug), focalX: 0.5, focalY: 0.5, placeholder: true });
  }
  await writeManifest(entries);
  const removed = await pruneMapsDir(entries);
  console.log(`Wrote ${entries.length} placeholders to public/maps/ (removed ${removed} stale files).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
