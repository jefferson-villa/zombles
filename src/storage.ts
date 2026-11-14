import { MAX_GUESSES } from './config';
import { daysBetween } from './daily';
import type { Mode, Status } from './types';

const KEY = {
  stats: (mode: Mode) => `zombles:stats:${mode}`,
  daily: 'zombles:daily',
  endless: 'zombles:endless',
  seen: 'zombles:seen',
  helpSeen: 'zombles:helpSeen',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota: the game still works, it just won't remember.
  }
}

// --- Stats ------------------------------------------------------------------

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[0..MAX_GUESSES-1] = won on guess N+1; distribution[MAX_GUESSES] = failed. */
  distribution: number[];
  /** Daily only: date of the last counted game, so a skipped day breaks the streak. */
  lastDate?: string;
}

const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: Array(MAX_GUESSES + 1).fill(0),
});

export function loadStats(mode: Mode): Stats {
  const s = read(KEY.stats(mode), emptyStats());
  if (s.distribution.length !== MAX_GUESSES + 1) s.distribution = emptyStats().distribution;
  return s;
}

/** guesses = number of guesses used (1..MAX_GUESSES). */
export function recordResult(mode: Mode, won: boolean, guesses: number, dateKey?: string): Stats {
  const s = loadStats(mode);
  s.played++;
  if (won) {
    s.wins++;
    const continues = mode === 'endless' || (s.lastDate !== undefined && dateKey !== undefined && daysBetween(s.lastDate, dateKey) === 1);
    s.currentStreak = continues ? s.currentStreak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
    s.distribution[guesses - 1]++;
  } else {
    s.currentStreak = 0;
    s.distribution[MAX_GUESSES]++;
  }
  if (dateKey) s.lastDate = dateKey;
  write(KEY.stats(mode), s);
  return s;
}

/** Daily streaks also break when a day is skipped without playing. */
export function displayStreak(mode: Mode, s: Stats, todayKey: string): number {
  if (mode !== 'daily' || !s.lastDate) return s.currentStreak;
  return daysBetween(s.lastDate, todayKey) <= 1 ? s.currentStreak : 0;
}

// --- Round state ------------------------------------------------------------

export interface RoundState {
  /** Daily: the YYYY-MM-DD it belongs to. Endless: unused. */
  date?: string;
  imageId: string;
  guesses: string[];
  status: Status;
}

export function loadRound(mode: Mode): RoundState | null {
  const r = read<RoundState | null>(mode === 'daily' ? KEY.daily : KEY.endless, null);
  return r && Array.isArray(r.guesses) ? r : null;
}

export function saveRound(mode: Mode, r: RoundState): void {
  write(mode === 'daily' ? KEY.daily : KEY.endless, r);
}

// --- Endless "seen" set -------------------------------------------------------

export function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY.seen) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function saveSeen(seen: Set<string>): void {
  write(KEY.seen, [...seen]);
}

export function helpSeen(): boolean {
  try {
    return localStorage.getItem(KEY.helpSeen) === '1';
  } catch {
    return true;
  }
}

export function markHelpSeen(): void {
  try {
    localStorage.setItem(KEY.helpSeen, '1');
  } catch {
    /* ignore */
  }
}
