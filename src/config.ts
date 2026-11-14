// Game constants. Also imported by scripts/fetch-wiki.js (Node strips the
// types natively), so keep this file to plain, erasable TypeScript.

/** Guesses per round. Should equal ZOOM_STEPS.length. */
export const MAX_GUESSES = 5;

/** Zoom level shown before guess N+1 (index = wrong guesses so far). 1 = full frame. */
export const ZOOM_STEPS: readonly number[] = [4, 3, 2.2, 1.6, 1];

/** The BO1/BO2 hint chip appears once this many wrong guesses have been made. */
export const HINT_AFTER_GUESS = 2;

/** Upper bound on files downloaded per map by `npm run fetch`. */
export const MAX_CANDIDATES_PER_MAP = 25;

/** Daily puzzle #1 is this local date. */
export const DAILY_EPOCH = '2026-01-01';

/** Zoom animation length. Written into the --zoom-ms CSS variable at startup. */
export const ZOOM_MS = 400;
