#!/usr/bin/env node
// Download candidate screenshots from the Call of Duty Wiki via the MediaWiki API.
//
//   npm run fetch                     # every map
//   npm run fetch -- kino-der-toten   # one or more slugs
//   npm run fetch -- --dry-run moon   # list what would be downloaded
//
// Writes raw/<slug>/<original filename> and raw/sources.json. Uses only Node
// built-ins (global fetch, fs). Every request is spaced >= REQUEST_GAP_MS apart.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../shared/maps.js';
import { MAX_CANDIDATES_PER_MAP } from '../src/config.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'raw');
const SOURCES_FILE = path.join(RAW_DIR, 'sources.json');

const WIKI_ORIGIN = 'https://callofduty.fandom.com';
const API = `${WIKI_ORIGIN}/api.php`;
// Set ZOMBLES_CONTACT (your repo URL or email) so wiki admins can reach you.
const CONTACT = process.env.ZOMBLES_CONTACT ? `; ${process.env.ZOMBLES_CONTACT}` : '';
const USER_AGENT = `ZomblesImageFetcher/0.1 (fan-made browser game; a few dozen screenshots per map via the API at 1 req/s${CONTACT})`;
const REQUEST_GAP_MS = 1100;

const MIN_WIDTH = 600;
const MIN_ASPECT = 4 / 3;
const MAX_ASPECT = 21 / 9;
const ASPECT_TOLERANCE = 0.01; // 1366x768 etc. round slightly
const BLOCKED_WORDS = [
  'logo', 'icon', 'concept', 'render', 'menu', 'loading', 'achievement', 'trophy',
  'bo3', 'boiii', 'chronicles', 'comparison', 'map layout', 'radar',
  // Keep it to Black Ops 1 & 2: drop other games' versions of the same maps.
  'black ops 3', 'black ops iii', 'blackops3', 'bo4', 'black ops 4', 'waw', 'world at war',
  'codv', 'vanguard', 'codm', 'cod mobile', 'mobile', 'ipod', 'iphone', 'ip codz',
  // Non-screenshots that slipped through on the Kino test run.
  'promo', 'wallpaper', 'comic',
];
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ---------------------------------------------------------------------------
// Polite HTTP

let lastRequestAt = 0;
async function politeFetch(url, init = {}) {
  const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } });
  return res;
}

async function api(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  await assertAllowed(url);
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
  const json = await res.json();
  if (json.error) throw new Error(`API error: ${json.error.code}: ${json.error.info}`);
  return json;
}

// ---------------------------------------------------------------------------
// robots.txt
//
// Fandom serves robots.txt behind a Cloudflare browser challenge, so a script
// often can't read it. In that case we fall back to the rules we read by hand
// from the `User-agent: *` group (2026-11-14), which allow /api.php?action=…
// and only disallow wiki namespaces we never touch. A host whose robots.txt is
// a 404 (static.wikia.nocookie.net) allows everything.

const ROBOTS_FALLBACK = {
  'callofduty.fandom.com': `User-agent: *
Allow: /api.php?
Allow: /api.php?action=
Allow: /api.php?*&action=
Disallow: /wiki/Special:
Disallow: /wiki/User_talk:
Disallow: /wiki/Template:
Disallow: /wiki/Template_talk:
Disallow: /wiki/Help:
Disallow: /wiki/User:
Disallow: /wiki/UserProfile:`,
};

const robotsCache = new Map();

async function rulesFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const host = new URL(origin).host;
  let text = '';
  let source = 'live';
  try {
    const res = await politeFetch(`${origin}/robots.txt`);
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.startsWith('text/plain')) text = await res.text();
    else if (res.status === 404 || res.status === 410) source = 'none (404: allow all)';
    else {
      text = ROBOTS_FALLBACK[host] ?? '';
      source = `fallback snapshot (live fetch returned ${res.status} ${type.split(';')[0]})`;
    }
  } catch (err) {
    text = ROBOTS_FALLBACK[host] ?? '';
    source = `fallback snapshot (${err.message})`;
  }
  const rules = parseRobots(text, 'zomblesimagefetcher');
  console.log(`robots.txt for ${host}: ${source}, ${rules.length} rules apply`);
  robotsCache.set(origin, rules);
  return rules;
}

/** Returns [{allow, pattern}] for the most specific matching group (or *). */
function parseRobots(text, agentToken) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === 'allow' || key === 'disallow') && value) {
        current.rules.push({ allow: key === 'allow', pattern: value });
      }
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agentToken.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

function robotsMatch(pattern, target) {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${re}${anchored ? '$' : ''}`).test(target);
}

async function assertAllowed(url) {
  const u = new URL(url);
  const rules = await rulesFor(u.origin);
  const target = u.pathname + u.search;
  // Longest matching rule wins; Allow wins ties (RFC 9309).
  let best = null;
  for (const r of rules) {
    if (!robotsMatch(r.pattern, target)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  if (best && !best.allow) throw new Error(`robots.txt disallows ${u.href} (${best.pattern})`);
}

// ---------------------------------------------------------------------------
// Wiki queries

async function categoryFiles(category) {
  const titles = [];
  let cont = {};
  do {
    const json = await api({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'file',
      cmlimit: '500',
      ...cont,
    });
    titles.push(...json.query.categorymembers.map((m) => m.title));
    cont = json.continue ?? null;
  } while (cont);
  return titles;
}

async function imageInfo(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const json = await api({
      action: 'query',
      titles: titles.slice(i, i + 50).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|user|extmetadata',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit',
    });
    for (const page of json.query.pages) {
      const info = page.imageinfo?.[0];
      if (info) out.push({ title: page.title, ...info });
    }
  }
  return out;
}

function rejectReason(file, map) {
  const name = file.title.replace(/^File:/, '').toLowerCase().replace(/_/g, ' ');
  const allowed = new Set(map.fetchAllow ?? []);
  const word = BLOCKED_WORDS.find((w) => !allowed.has(w) && name.includes(w));
  if (word) return `filename contains "${word}"`;
  if (!ALLOWED_MIME.has(file.mime)) return `type ${file.mime}`;
  if (file.width < (map.fetchMinWidth ?? MIN_WIDTH)) return `${file.width}px wide`;
  const aspect = file.width / file.height;
  if (aspect < MIN_ASPECT - ASPECT_TOLERANCE || aspect > MAX_ASPECT + ASPECT_TOLERANCE) {
    return `aspect ${aspect.toFixed(2)} (${file.width}x${file.height})`;
  }
  return null;
}

/** Wiki titles can contain characters Windows forbids in filenames. */
function safeFilename(title) {
  return title.replace(/^File:/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
}

function stripHtml(s) {
  return s ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined;
}

async function exists(p) {
  return fs.access(p).then(() => true, () => false);
}

// ---------------------------------------------------------------------------

async function fetchMap(map, sources, { dryRun }) {
  console.log(`=== ${map.name} (${map.slug}) — Category:${map.wikiCategory}`);
  const titles = await categoryFiles(map.wikiCategory);
  if (!titles.length) {
    console.warn(`  ! Category is empty or missing. Check wikiCategory in shared/maps.js.`);
    return { kept: 0, downloaded: 0 };
  }
  const infos = await imageInfo(titles);
  const kept = [];
  for (const f of infos) {
    const why = rejectReason(f, map);
    if (why) console.log(`  skip  ${f.title.replace(/^File:/, '')}  — ${why}`);
    else kept.push(f);
  }
  // Prefer the largest images when there are more candidates than we want.
  kept.sort((a, b) => b.width * b.height - a.width * a.height || a.title.localeCompare(b.title));
  const chosen = kept.slice(0, MAX_CANDIDATES_PER_MAP);
  console.log(`  ${titles.length} files in category, ${kept.length} pass filters, taking ${chosen.length}`);

  const dir = path.join(RAW_DIR, map.slug);
  if (!dryRun) await fs.mkdir(dir, { recursive: true });
  let downloaded = 0;
  for (const [n, f] of chosen.entries()) {
    const counter = `[${String(n + 1).padStart(2)}/${chosen.length}]`;
    const filename = safeFilename(f.title);
    const dest = path.join(dir, filename);
    const meta = f.extmetadata ?? {};
    sources[`${map.slug}/${filename}`] = {
      slug: map.slug,
      file: filename,
      filePage: f.descriptionurl,
      originalUrl: f.url,
      width: f.width,
      height: f.height,
      uploader: f.user,
      license: stripHtml(meta.LicenseShortName?.value),
      artist: stripHtml(meta.Artist?.value),
      attribution: `"${f.title.replace(/^File:/, '')}" from the Call of Duty Wiki (${f.descriptionurl}), uploaded by ${f.user}. Game content © Activision.`,
    };
    if (dryRun) {
      console.log(`  would get  ${filename}  ${f.width}x${f.height}`);
      continue;
    }
    if (await exists(dest)) {
      console.log(`  ${counter} have  ${filename}`);
      continue;
    }
    await assertAllowed(f.url);
    const res = await politeFetch(f.url);
    if (!res.ok) {
      console.warn(`  ! ${res.status} downloading ${f.url}`);
      delete sources[`${map.slug}/${filename}`];
      continue;
    }
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    downloaded++;
    console.log(`  ${counter} got   ${filename}  ${f.width}x${f.height}`);
  }
  return { kept: chosen.length, downloaded };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const slugs = args.filter((a) => !a.startsWith('--'));
  const unknown = slugs.filter((s) => !MAPS.some((m) => m.slug === s));
  if (unknown.length) {
    console.error(`Unknown slug(s): ${unknown.join(', ')}\nValid: ${MAPS.map((m) => m.slug).join(', ')}`);
    process.exit(1);
  }
  const targets = slugs.length ? MAPS.filter((m) => slugs.includes(m.slug)) : MAPS;

  await fs.mkdir(RAW_DIR, { recursive: true });
  const sources = (await exists(SOURCES_FILE)) ? JSON.parse(await fs.readFile(SOURCES_FILE, 'utf8')) : {};

  const summary = [];
  for (const [i, map] of targets.entries()) {
    console.log(`\n${progressBar(i, targets.length)}  map ${i + 1}/${targets.length}: ${map.name}`);
    try {
      summary.push([map.slug, await fetchMap(map, sources, { dryRun })]);
    } catch (err) {
      console.error(`  ! ${map.slug} failed: ${err.message}`);
      summary.push([map.slug, { error: err.message }]);
    }
    if (!dryRun) await fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2) + '\n');
  }

  console.log(`\n${progressBar(targets.length, targets.length)}  done`);
  if (!dryRun) await writeContactSheet();

  console.log('\nSummary');
  for (const [slug, r] of summary) {
    console.log(`  ${slug.padEnd(20)} ${r.error ? `ERROR ${r.error}` : `${r.kept} candidates, ${r.downloaded} new downloads`}`);
  }
  if (!dryRun) {
    console.log(`\nReview: npm run dev, then open http://localhost:5173/raw/contact-sheet.html`);
    console.log(`Next: delete bad shots from raw/<slug>/, then run \`npm run promote\`.`);
  }
}

function progressBar(done, total, width = 24) {
  const filled = Math.round((done / total) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${String(Math.round((done / total) * 100)).padStart(3)}%`;
}

/** raw/contact-sheet.html: every file currently in raw/<slug>/, for curation. Never shipped. */
async function writeContactSheet() {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const sections = [];
  for (const map of MAPS) {
    const files = (await fs.readdir(path.join(RAW_DIR, map.slug)).catch(() => [])).sort();
    if (!files.length) continue;
    const cards = files
      .map((f) => {
        const src = `${encodeURIComponent(map.slug)}/${encodeURIComponent(f)}`;
        return `<figure><a href="${src}" target="_blank"><img src="${src}" loading="lazy"></a><figcaption>${esc(f)}</figcaption></figure>`;
      })
      .join('');
    sections.push(`<h2>${esc(map.name)} <small>raw/${map.slug}/ · ${files.length}</small></h2><div class="grid">${cards}</div>`);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Zombles raw candidates</title>
<style>body{background:#111;color:#ddd;font:14px system-ui;margin:16px}h2 small{color:#888;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
figure{margin:0;background:#1b1b1b;border-radius:6px;overflow:hidden}img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
figcaption{padding:6px 8px;font-size:12px;word-break:break-all}</style>
<h1>Raw candidates</h1><p>Delete files you don't want from raw/&lt;slug&gt;/, then run <code>npm run promote</code>. Re-run <code>npm run fetch</code> to refresh this page.</p>
${sections.join('\n')}`;
  await fs.writeFile(path.join(RAW_DIR, 'contact-sheet.html'), html);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
