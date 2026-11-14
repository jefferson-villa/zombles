// The full answer set. Shared by the client (autocomplete, reveal) and the Node
// scripts (fetch-wiki, promote, placeholders), so it lives in plain JS.
//
// wikiCategory values were verified against callofduty.fandom.com via
// list=allcategories on 2026-11-14. Note "Five" keeps its literal quotes.

/**
 * @typedef {'BO1' | 'BO2'} Game
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   game: Game,
 *   wikiCategory: string,
 *   aliases: string[],
 *   color: string,
 *   fetchAllow?: string[],
 *   fetchMinWidth?: number,
 * }} ZMap
 *
 * fetchAllow: BLOCKED_WORDS in scripts/fetch-wiki.js to ignore for this map.
 * The four World at War-era maps accept "WaW" shots, since that's where they
 * come from and the BO1 versions look the same.
 * fetchMinWidth: overrides MIN_WIDTH (600) for maps with few large screenshots.
 */

/** @type {ZMap[]} */
export const MAPS = [
  // Black Ops 1
  { slug: 'kino-der-toten', name: 'Kino der Toten', game: 'BO1', wikiCategory: 'Kino der Toten images', aliases: ['Kino', 'Theater', 'Theatre'], color: '#7a2e2e' },
  { slug: 'five', name: '"Five"', game: 'BO1', wikiCategory: '"Five" images', aliases: ['Five', '5', 'Pentagon'], color: '#2e4a7a' },
  { slug: 'ascension', name: 'Ascension', game: 'BO1', wikiCategory: 'Ascension images', aliases: ['Cosmodrome', 'Space monkeys'], color: '#4a5a2e' },
  { slug: 'call-of-the-dead', name: 'Call of the Dead', game: 'BO1', wikiCategory: 'Call of the Dead images', aliases: ['COTD', 'George Romero', 'Lighthouse'], color: '#2e6a6a' },
  { slug: 'shangri-la', name: 'Shangri-La', game: 'BO1', wikiCategory: 'Shangri-La images', aliases: ['Shangri La', 'Shangrila', 'Temple'], color: '#6a5a2e' },
  { slug: 'moon', name: 'Moon', game: 'BO1', wikiCategory: 'Moon images', aliases: ['Griffin Station', 'Area 51', 'Hangar 18'], color: '#4a4a5a' },
  { slug: 'nacht-der-untoten', name: 'Nacht der Untoten', game: 'BO1', wikiCategory: 'Nacht der Untoten images', aliases: ['Nacht', 'Night of the Undead', 'Airfield'], fetchAllow: ['waw', 'world at war'], color: '#5a3a2a' },
  { slug: 'verruckt', name: 'Verrückt', game: 'BO1', wikiCategory: 'Verrückt images', aliases: ['Verruckt', 'Asylum', 'Wittenau Sanatorium'], fetchAllow: ['waw', 'world at war'], fetchMinWidth: 480, color: '#3a5a3a' },
  { slug: 'shi-no-numa', name: 'Shi No Numa', game: 'BO1', wikiCategory: 'Shi No Numa images', aliases: ['Swamp', 'Zombie Swamp', 'Rising Sun facility'], fetchAllow: ['waw', 'world at war'], fetchMinWidth: 480, color: '#2e5a4a' },
  { slug: 'der-riese', name: 'Der Riese', game: 'BO1', wikiCategory: 'Der Riese images', aliases: ['The Giant', 'Factory', 'Breslau'], fetchAllow: ['waw', 'world at war'], color: '#5a2e5a' },
  // Black Ops 2
  { slug: 'tranzit', name: 'TranZit', game: 'BO2', wikiCategory: 'TranZit images', aliases: ['Green Run', 'Transit', 'Bus Depot', 'Farm', 'Town'], color: '#3a6a2e' },
  { slug: 'nuketown-zombies', name: 'Nuketown Zombies', game: 'BO2', wikiCategory: 'Nuketown Zombies images', aliases: ['Nuketown', 'Nuketown Zombie'], color: '#7a5a2e' },
  { slug: 'die-rise', name: 'Die Rise', game: 'BO2', wikiCategory: 'Die Rise images', aliases: ['Great Leap Forward', 'Skyscraper'], color: '#2e3a7a' },
  { slug: 'mob-of-the-dead', name: 'Mob of the Dead', game: 'BO2', wikiCategory: 'Mob of the Dead images', aliases: ['MOTD', 'Alcatraz', 'Prison'], color: '#6a2e3a' },
  { slug: 'buried', name: 'Buried', game: 'BO2', wikiCategory: 'Buried images', aliases: ['Resolution 1295', 'Western', 'Angola'], color: '#6a4a2e' },
  { slug: 'origins', name: 'Origins', game: 'BO2', wikiCategory: 'Origins images', aliases: ['Excavation Site 64', 'Dig site', 'Staffs'], color: '#5a5a2e' },
];

/** @type {Record<Game, string>} */
export const GAME_NAMES = { BO1: 'Black Ops', BO2: 'Black Ops II' };

/** @param {string} slug */
export function mapBySlug(slug) {
  return MAPS.find((m) => m.slug === slug);
}
