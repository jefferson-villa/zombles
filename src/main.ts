import './style.css';
import { GAME_NAMES, mapBySlug } from '../shared/maps.js';
import { MAX_GUESSES, ZOOM_STEPS, HINT_AFTER_GUESS, ZOOM_MS } from './config';
import { loadManifest, imageUrl, isCorrect, resolveAnswer, type ManifestEntry } from './manifest';
import { localDateKey, dailyEntry, puzzleNumber, msUntilLocalMidnight } from './daily';
import { ZoomView } from './zoom';
import { MapPicker } from './autocomplete';
import * as store from './storage';
import type { Mode, Status } from './types';

interface Round {
  mode: Mode;
  entry: ManifestEntry;
  date?: string;
  guesses: string[];
  status: Status;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let entries: ManifestEntry[] = [];
let round: Round;
let mode: Mode = location.hash === '#endless' ? 'endless' : 'daily';
let statsMode: Mode = mode;
let countdownTimer: number | undefined;

const zoom = new ZoomView($('frame'));
const picker = new MapPicker($('picker'), (slug) => guess(slug));

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.style.setProperty('--zoom-ms', `${ZOOM_MS}ms`);
}
$('help-guesses').textContent = String(MAX_GUESSES);
$('help-hint').textContent = String(HINT_AFTER_GUESS);

// ---------------------------------------------------------------------------
// Rounds

async function startDaily(): Promise<void> {
  const today = localDateKey();
  const entry = dailyEntry(entries, today);
  const saved = store.loadRound('daily');
  const resume = saved && saved.date === today && saved.imageId === entry.id;
  round = {
    mode: 'daily',
    entry,
    date: today,
    guesses: resume ? saved.guesses : [],
    status: resume ? saved.status : 'playing',
  };
  if (!resume) persist();
  await showRound();
}

async function startEndless(forceNew = false): Promise<void> {
  const saved = store.loadRound('endless');
  const savedEntry = saved && entries.find((e) => e.id === saved.imageId);
  if (!forceNew && saved && savedEntry) {
    round = { mode: 'endless', entry: savedEntry, guesses: saved.guesses, status: saved.status };
  } else {
    round = { mode: 'endless', entry: pickUnseen(), guesses: [], status: 'playing' };
    persist();
  }
  await showRound();
}

/** Random image the player hasn't had in Endless yet; starts a new cycle once all are seen. */
function pickUnseen(): ManifestEntry {
  let seen = store.loadSeen();
  let pool = entries.filter((e) => !seen.has(e.id));
  if (!pool.length) {
    // Everything seen: start a fresh cycle, but don't repeat the image just played.
    const last = round?.mode === 'endless' ? round.entry.id : undefined;
    seen = new Set();
    pool = entries.length > 1 ? entries.filter((e) => e.id !== last) : entries;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  seen.add(pick.id);
  store.saveSeen(seen);
  return pick;
}

function persist(): void {
  store.saveRound(round.mode, { date: round.date, imageId: round.entry.id, guesses: round.guesses, status: round.status });
}

const wrongCount = () => round.guesses.filter((g) => !isCorrect(round.entry, g)).length;

function guess(slug: string): void {
  if (round.status !== 'playing' || round.guesses.includes(slug)) return;
  round.guesses.push(slug);
  if (isCorrect(round.entry, slug)) round.status = 'won';
  else if (round.guesses.length >= MAX_GUESSES) round.status = 'lost';
  persist();
  if (round.status !== 'playing') {
    store.recordResult(round.mode, round.status === 'won', round.guesses.length, round.date);
  }
  render();
  if (round.status === 'playing') picker.focus();
}

// ---------------------------------------------------------------------------
// Rendering

async function showRound(): Promise<void> {
  const ended = round.status !== 'playing';
  const z = ZOOM_STEPS[Math.min(wrongCount(), ZOOM_STEPS.length - 1)];
  await zoom.show(imageUrl(round.entry), round.entry.focalX, round.entry.focalY, z);
  if (ended) zoom.reveal();
  render();
  if (!ended) picker.focus();
}

function render(): void {
  const ended = round.status !== 'playing';
  const wrong = wrongCount();

  // Tabs
  for (const tab of document.querySelectorAll<HTMLButtonElement>('.modes [data-mode]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
  }
  $('daily-num').textContent = `#${puzzleNumber(localDateKey())}`;

  // Image
  const level = ZOOM_STEPS[Math.min(wrong, ZOOM_STEPS.length - 1)];
  if (ended) zoom.reveal();
  else zoom.setZoom(level);
  $('zoom-badge').textContent = ended ? '' : `${Math.round(level * 100)}%`;
  $('zoom-badge').hidden = ended;

  // Hint
  const hint = $('hint-chip');
  hint.hidden = ended || wrong < HINT_AFTER_GUESS;
  if (!hint.hidden) {
    const game = resolveAnswer(round.entry).game;
    hint.textContent = `Hint: ${GAME_NAMES[game]} (${game})`;
  }

  // Guess slots
  const list = $('guesses');
  list.replaceChildren();
  for (let i = 0; i < MAX_GUESSES; i++) {
    const li = document.createElement('li');
    const slug = round.guesses[i];
    if (slug) {
      const right = isCorrect(round.entry, slug);
      li.className = right ? 'right' : 'wrong';
      li.innerHTML = `<span class="mark">${right ? '✓' : '✗'}</span><span class="name"></span>`;
      li.querySelector('.name')!.textContent = mapBySlug(slug)?.name ?? slug;
    } else {
      li.className = i === round.guesses.length && !ended ? 'empty current' : 'empty';
      li.innerHTML = `<span class="mark">${i + 1}</span><span class="name"></span>`;
    }
    list.append(li);
  }

  // Input
  picker.setExcluded(round.guesses);
  picker.setEnabled(!ended);
  $('picker').hidden = ended;

  // Result
  $('result').hidden = !ended;
  if (ended) {
    const answer = resolveAnswer(round.entry);
    $('result-head').textContent =
      round.status === 'won' ? `Got it in ${round.guesses.length}/${MAX_GUESSES}` : `Out of guesses (X/${MAX_GUESSES})`;
    $('result').className = `result ${round.status}`;
    $('result-map').textContent = answer.name;
    $('result-game').textContent = `${GAME_NAMES[answer.game]} (${answer.game})`;
    $('next-btn').hidden = round.mode !== 'endless';
    $('countdown-wrap').hidden = round.mode !== 'daily';
  }
  updateCountdown();
}

function updateCountdown(): void {
  window.clearInterval(countdownTimer);
  if (round.mode !== 'daily' || round.status === 'playing') return;
  const tick = () => {
    const ms = msUntilLocalMidnight();
    const s = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    $('countdown').textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    if (round.date !== localDateKey()) {
      window.clearInterval(countdownTimer);
      if (mode === 'daily') void startDaily();
    }
  };
  tick();
  countdownTimer = window.setInterval(tick, 1000);
}

// ---------------------------------------------------------------------------
// Share

function shareText(): string {
  const won = round.status === 'won';
  const score = won ? `${round.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const label = round.mode === 'daily' ? `Zombles #${puzzleNumber(round.date!)}` : 'Zombles Endless';
  const squares = won ? '🧟'.repeat(round.guesses.length - 1) + '🟩' : '🧟'.repeat(MAX_GUESSES - 1) + '🟥';
  return `${label} ${score}\n${squares}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

let toastTimer: number | undefined;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2000);
}

// ---------------------------------------------------------------------------
// Stats dialog

function renderStats(): void {
  const today = localDateKey();
  const s = store.loadStats(statsMode);
  $('stats-title').innerHTML = `Statistics <span class="stats-switch">
    <button data-stats="daily" aria-pressed="${statsMode === 'daily'}">Daily</button>
    <button data-stats="endless" aria-pressed="${statsMode === 'endless'}">Endless</button></span>`;
  const cells: [string, number | string][] = [
    ['Played', s.played],
    ['Win %', s.played ? Math.round((s.wins / s.played) * 100) : 0],
    ['Streak', store.displayStreak(statsMode, s, today)],
    ['Max streak', s.maxStreak],
  ];
  $('stat-row').innerHTML = cells.map(([k, v]) => `<div><strong>${v}</strong><span>${k}</span></div>`).join('');

  const max = Math.max(1, ...s.distribution);
  const highlight =
    round && round.mode === statsMode && round.status !== 'playing'
      ? round.status === 'won'
        ? round.guesses.length - 1
        : MAX_GUESSES
      : -1;
  $('dist').innerHTML = s.distribution
    .map((n, i) => {
      const label = i < MAX_GUESSES ? String(i + 1) : 'X';
      const pct = Math.max(7, (n / max) * 100);
      return `<div class="dist-row"><span>${label}</span><div class="bar${i === highlight ? ' hl' : ''}${i === MAX_GUESSES ? ' fail' : ''}" style="width:${pct}%">${n}</div></div>`;
    })
    .join('');
}

function openStats(): void {
  statsMode = mode;
  renderStats();
  $<HTMLDialogElement>('stats-dialog').showModal();
}

// ---------------------------------------------------------------------------
// Wiring

async function switchMode(next: Mode): Promise<void> {
  if (next === mode && round) return;
  mode = next;
  history.replaceState(null, '', next === 'endless' ? '#endless' : location.pathname + location.search);
  await (mode === 'daily' ? startDaily() : startEndless());
}

for (const tab of document.querySelectorAll<HTMLButtonElement>('.modes [data-mode]')) {
  tab.addEventListener('click', () => void switchMode(tab.dataset.mode as Mode));
}
$('help-btn').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').showModal());
$('stats-btn').addEventListener('click', openStats);
$('result-stats-btn').addEventListener('click', openStats);
$('stats-title').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-stats]');
  if (b) {
    statsMode = b.dataset.stats as Mode;
    renderStats();
  }
});
$('next-btn').addEventListener('click', () => void startEndless(true));
$('share-btn').addEventListener('click', async () => {
  toast((await copy(shareText())) ? 'Copied result to clipboard' : 'Could not copy. Your browser blocked clipboard access.');
});
// Close dialogs on backdrop click.
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
}

async function boot(): Promise<void> {
  try {
    entries = await loadManifest();
  } catch (err) {
    $('frame').innerHTML = `<p class="error">Couldn't load the puzzle list (${(err as Error).message}).</p>`;
    $('picker').hidden = true;
    return;
  }
  $('placeholder-banner').hidden = !entries.some((e) => e.placeholder);
  await (mode === 'daily' ? startDaily() : startEndless());
  if (!store.helpSeen()) {
    store.markHelpSeen();
    $<HTMLDialogElement>('help-dialog').showModal();
  }
}

void boot();
