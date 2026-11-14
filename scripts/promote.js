#!/usr/bin/env node
// Copy the curated screenshots in raw/<slug>/ into public/maps/ under
// content-hashed names and regenerate public/maps/manifest.json.
//
//   npm run promote
//   npm run promote -- --keep-placeholders   # keep placeholders for maps with no real images yet
//
// Hand-edited focalX/focalY values survive re-runs (matched by image id, which
// is a hash of the file contents).

import fs from 'node:fs/promises';
import path from 'node:path';
import { MAPS } from '../shared/maps.js';
import { imageId, answerToken } from '../shared/hash.js';
import { RAW_DIR, MAPS_DIR, readManifest, writeManifest, pruneMapsDir } from './lib.js';

const EXTENSIONS = new Map([
  ['.jpg', '.jpg'],
  ['.jpeg', '.jpg'],
  ['.png', '.png'],
  ['.webp', '.webp'],
]);

async function main() {
  const keepPlaceholders = process.argv.includes('--keep-placeholders');
  const previous = await readManifest();
  const previousById = new Map(previous.map((e) => [e.id, e]));

  const entries = [];
  const counts = [];
  for (const map of MAPS) {
    const dir = path.join(RAW_DIR, map.slug);
    const names = (await fs.readdir(dir).catch(() => [])).filter((n) => EXTENSIONS.has(path.extname(n).toLowerCase()));
    const seen = new Set();
    for (const name of names.sort()) {
      const bytes = await fs.readFile(path.join(dir, name));
      const id = imageId(bytes);
      if (seen.has(id)) continue; // identical file uploaded twice on the wiki
      seen.add(id);
      const file = id + EXTENSIONS.get(path.extname(name).toLowerCase());
      await fs.mkdir(MAPS_DIR, { recursive: true });
      await fs.writeFile(path.join(MAPS_DIR, file), bytes);
      const old = previousById.get(id);
      entries.push({
        id,
        file,
        slug: answerToken(id, map.slug),
        focalX: old?.focalX ?? 0.5,
        focalY: old?.focalY ?? 0.5,
      });
    }
    counts.push([map, seen.size]);
  }

  if (!entries.length) {
    console.error('No images found in raw/<slug>/. Run `npm run fetch` first. Leaving public/maps/ untouched.');
    process.exit(1);
  }

  const missing = counts.filter(([, n]) => n === 0).map(([m]) => m);
  if (keepPlaceholders) {
    for (const map of missing) {
      for (const e of previous) {
        if (e.placeholder && e.slug === answerToken(e.id, map.slug)) entries.push(e);
      }
    }
  }

  await writeManifest(entries);
  const removed = await pruneMapsDir(entries);

  for (const [map, n] of counts) console.log(`  ${map.slug.padEnd(20)} ${n}`);
  const preserved = entries.filter((e) => !e.placeholder && previousById.has(e.id)).length;
  console.log(`\nManifest: ${entries.length} images (${preserved} kept their focal points), removed ${removed} stale files.`);
  if (missing.length) {
    const what = keepPlaceholders ? 'still using placeholders' : 'have NO images and cannot be an answer';
    console.warn(`Warning: ${missing.map((m) => m.slug).join(', ')} ${what}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
