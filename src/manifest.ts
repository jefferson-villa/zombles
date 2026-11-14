import { MAPS } from '../shared/maps.js';
import { answerToken } from '../shared/hash.js';
import type { ZMapT } from './types';

export interface ManifestEntry {
  id: string;
  file: string;
  /** answerToken(id, slug) — the real slug is never shipped. */
  slug: string;
  focalX: number;
  focalY: number;
  placeholder?: true;
}

export async function loadManifest(): Promise<ManifestEntry[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}maps/manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  const entries = (await res.json()) as ManifestEntry[];
  if (!entries.length) throw new Error('manifest.json is empty');
  return entries;
}

export function imageUrl(entry: ManifestEntry): string {
  return `${import.meta.env.BASE_URL}maps/${entry.file}`;
}

export function isCorrect(entry: ManifestEntry, slug: string): boolean {
  return answerToken(entry.id, slug) === entry.slug;
}

/** Brute-forces the 16 candidates. Only called for the hint chip and the end-of-round reveal. */
export function resolveAnswer(entry: ManifestEntry): ZMapT {
  const map = MAPS.find((m) => isCorrect(entry, m.slug));
  if (!map) throw new Error(`Manifest entry ${entry.id} matches no known map`);
  return map;
}
