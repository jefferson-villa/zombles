import { DAILY_EPOCH } from './config';
import { hashString } from '../shared/hash.js';
import type { ManifestEntry } from './manifest';

/** YYYY-MM-DD in the player's local time zone. */
export function localDateKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days between two YYYY-MM-DD keys (calendar days, DST-safe). */
export function daysBetween(fromKey: string, toKey: string): number {
  const utc = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000);
}

/** Puzzle #1 is DAILY_EPOCH. */
export function puzzleNumber(dateKey: string): number {
  return daysBetween(DAILY_EPOCH, dateKey) + 1;
}

/**
 * Same image for everyone on a given date. The manifest is put in a fixed
 * pseudo-random order (seeded shuffle) and day N takes item N mod length, so
 * every image is used once before any repeats.
 */
export function dailyEntry(entries: ManifestEntry[], dateKey: string): ManifestEntry {
  const order = seededShuffle([...entries].sort((a, b) => a.id.localeCompare(b.id)), 'zombles-daily');
  const n = puzzleNumber(dateKey) - 1;
  return order[((n % order.length) + order.length) % order.length];
}

export function msUntilLocalMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = parseInt(hashString(seed).slice(0, 8), 16) >>> 0;
  const rand = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
