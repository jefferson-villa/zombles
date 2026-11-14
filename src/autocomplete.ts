// Accessible combobox that only ever yields a valid map slug. Free text is for
// filtering; submitting requires an option to be highlighted.

import { MAPS } from '../shared/maps.js';
import type { ZMapT } from './types';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

interface Match {
  map: ZMapT;
  via?: string; // alias that matched, if not the name
  score: number;
}

function search(query: string, exclude: Set<string>): Match[] {
  const q = normalize(query);
  const out: Match[] = [];
  for (const map of MAPS) {
    if (exclude.has(map.slug)) continue;
    if (!q) {
      out.push({ map, score: 0 });
      continue;
    }
    const candidates: [string, string | undefined][] = [[map.name, undefined], ...map.aliases.map((a): [string, string] => [a, a])];
    let best: Match | null = null;
    for (const [text, via] of candidates) {
      const t = normalize(text);
      const score = t === q ? 3 : t.startsWith(q) ? 2 : t.split(' ').some((w) => w.startsWith(q)) ? 1.5 : t.includes(q) ? 1 : 0;
      // Prefer the display name over an alias at equal score.
      if (score && (!best || score > best.score)) best = { map, via, score };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score || MAPS.indexOf(a.map) - MAPS.indexOf(b.map));
}

export class MapPicker {
  private input: HTMLInputElement;
  private list: HTMLUListElement;
  private button: HTMLButtonElement;
  private matches: Match[] = [];
  private active = -1;
  private exclude = new Set<string>();

  constructor(root: HTMLElement, private onPick: (slug: string) => void) {
    this.input = root.querySelector('input')!;
    this.list = root.querySelector('ul')!;
    this.button = root.querySelector('button')!;

    this.input.addEventListener('input', () => this.refresh(true));
    // Open on click/tap, not on programmatic focus, so the list doesn't cover the image.
    this.input.addEventListener('click', () => this.refresh(false));
    this.input.addEventListener('blur', () => setTimeout(() => this.close(), 120));
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
    this.list.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest('li');
      if (li?.dataset.index) this.choose(Number(li.dataset.index));
    });
    this.button.addEventListener('click', () => {
      if (this.active < 0 && this.matches.length === 1) this.active = 0;
      if (this.active >= 0) this.choose(this.active);
      else this.input.focus();
    });
  }

  setExcluded(slugs: Iterable<string>): void {
    this.exclude = new Set(slugs);
  }

  setEnabled(enabled: boolean): void {
    this.input.disabled = !enabled;
    this.button.disabled = !enabled;
    if (!enabled) {
      this.input.value = '';
      this.close();
    }
  }

  focus(): void {
    // Don't pop the on-screen keyboard over the image on touch devices.
    if (!matchMedia('(pointer: coarse)').matches) this.input.focus({ preventScroll: true });
  }

  private refresh(autoHighlight: boolean): void {
    this.matches = search(this.input.value, this.exclude);
    this.active = autoHighlight && this.input.value.trim() && this.matches.length ? 0 : -1;
    this.render();
  }

  private render(): void {
    this.list.replaceChildren(
      ...this.matches.map((m, i) => {
        const li = document.createElement('li');
        li.id = `opt-${m.map.slug}`;
        li.role = 'option';
        li.dataset.index = String(i);
        li.setAttribute('aria-selected', String(i === this.active));
        const name = document.createElement('span');
        name.textContent = m.map.name;
        li.append(name);
        if (m.via) {
          const via = document.createElement('small');
          via.textContent = `“${m.via}”`;
          li.append(via);
        }
        return li;
      }),
    );
    if (!this.matches.length && this.input.value.trim()) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No matching map';
      this.list.append(li);
    }
    const open = this.list.childElementCount > 0 && document.activeElement === this.input;
    this.list.hidden = !open;
    this.input.setAttribute('aria-expanded', String(open));
    const activeEl = this.active >= 0 ? this.list.children[this.active] : null;
    if (activeEl) {
      this.input.setAttribute('aria-activedescendant', activeEl.id);
      activeEl.scrollIntoView({ block: 'nearest' });
    } else this.input.removeAttribute('aria-activedescendant');
    this.button.classList.toggle('ready', this.active >= 0);
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.matches.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.list.hidden) this.refresh(false);
      if (!n) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      this.active = this.active < 0 ? (delta > 0 ? 0 : n - 1) : (this.active + delta + n) % n;
      this.render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.active < 0 && n === 1) this.active = 0;
      if (this.active >= 0) this.choose(this.active);
    } else if (e.key === 'Escape') {
      this.close();
    } else if (e.key === 'Tab' && this.active >= 0 && !this.list.hidden) {
      // Tab completes the highlighted option instead of leaving the field.
      e.preventDefault();
      this.input.value = this.matches[this.active].map.name;
    }
  }

  private choose(i: number): void {
    const m = this.matches[i];
    if (!m) return;
    this.input.value = '';
    this.close();
    this.onPick(m.map.slug);
  }

  private close(): void {
    this.list.hidden = true;
    this.active = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.button.classList.remove('ready');
  }
}
