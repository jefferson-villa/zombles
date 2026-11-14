// Helpers shared by promote.js and placeholders.js.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAW_DIR = path.join(ROOT, 'raw');
export const MAPS_DIR = path.join(ROOT, 'public', 'maps');
export const MANIFEST_FILE = path.join(MAPS_DIR, 'manifest.json');

/**
 * @typedef {{ id: string, file: string, slug: string, focalX: number, focalY: number, placeholder?: true }} ManifestEntry
 * `slug` is answerToken(id, realSlug), never the plain slug.
 */

/** @returns {Promise<ManifestEntry[]>} */
export async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_FILE, 'utf8'));
  } catch {
    return [];
  }
}

/** @param {ManifestEntry[]} entries */
export async function writeManifest(entries) {
  // Sorted by id (a content hash) so the order carries no map grouping.
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const body = '[\n' + sorted.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n';
  await fs.mkdir(MAPS_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_FILE, body);
}

/** Delete every image in public/maps that isn't referenced by `entries`. */
export async function pruneMapsDir(entries) {
  const keep = new Set(entries.map((e) => e.file));
  let removed = 0;
  for (const name of await fs.readdir(MAPS_DIR).catch(() => [])) {
    if (name === 'manifest.json' || keep.has(name)) continue;
    await fs.rm(path.join(MAPS_DIR, name));
    removed++;
  }
  return removed;
}
