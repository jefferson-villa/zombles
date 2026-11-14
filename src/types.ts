import type { MAPS } from '../shared/maps.js';

export type ZMapT = (typeof MAPS)[number];
export type Mode = 'daily' | 'endless';
export type Status = 'playing' | 'won' | 'lost';
