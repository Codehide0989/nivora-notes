import type { Note } from '@/types';
import type { SortBy } from '@/store/settings';
import { toPlain } from '@/utils/markdown';

export function sortNotes(list: Note[], by: SortBy): Note[] {
  const arr = [...list];
  if (by === 'title') arr.sort((a, b) => (a.title.trim() || '￿').localeCompare(b.title.trim() || '￿'));
  else if (by === 'created') arr.sort((a, b) => b.createdAt - a.createdAt);
  else arr.sort((a, b) => b.updatedAt - a.updatedAt);
  return arr;
}

/** Locked notes only expose their title to search, never their body. */
export function noteSearchText(n: Note): string {
  return `${n.title}\n${n.locked ? '' : toPlain(n.body)}\n${n.tags.join(' ')}`.toLowerCase();
}

export interface Piece {
  text: string;
  hit: boolean;
}

/** Split `text` into pieces so that every occurrence of any query word is flagged as a hit. */
export function highlight(text: string, query: string): Piece[] {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length || !text) return [{ text, hit: false }];
  const re = new RegExp(`(${words.join('|')})`, 'ig');
  const out: Piece[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}

/** A short excerpt of `text` around the first match of the query. */
export function snippetAround(text: string, query: string, radius = 70): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = flat.toLowerCase();
  let idx = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return flat.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(flat.length, idx + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

export function scoreNote(n: Note, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const words = q.split(/\s+/).filter(Boolean);
  const title = n.title.toLowerCase();
  const text = noteSearchText(n);
  let score = 0;
  for (const w of words) {
    if (title.includes(w)) score += title.startsWith(w) ? 6 : 4;
    if (text.includes(w)) score += 1;
    else return 0; // every word must match somewhere
  }
  if (n.pinned) score += 1;
  return score;
}
