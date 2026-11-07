// Per-person navigation stack. Pure functions, no I/O, so the rules are testable.
// This is NOT the history log: history is every visit ever made; this is the
// back/forward stack, which is truncated by new navigation.
export type Target = { kind: 'page'; address: string } | { kind: 'search'; query: string };
export type Entry = Target & { scrollY: number };
export interface NavState { entries: Entry[]; cursor: number }

export const emptyNav = (): NavState => ({ entries: [], cursor: -1 });
const clone = (s: NavState): NavState => ({ entries: s.entries.map((e) => ({ ...e })), cursor: s.cursor });

export function sameTarget(a: Target, b: Target): boolean {
  if (a.kind === 'page' && b.kind === 'page') return a.address === b.address;
  if (a.kind === 'search' && b.kind === 'search') return a.query === b.query;
  return false;
}
export const entryKey = (e: Target) => (e.kind === 'page' ? `page:${e.address}` : `search:${e.query}`);

// "Restore on return": the entry being left remembers where the reader was.
export function setScroll(s: NavState, y: number): NavState {
  const n = clone(s);
  if (n.cursor >= 0) n.entries[n.cursor].scrollY = y;
  return n;
}

export function go(s: NavState, t: Target, leavingScrollY: number): NavState {
  const n = setScroll(s, leavingScrollY);
  const cur = n.entries[n.cursor];
  if (cur && sameTarget(cur, t)) { cur.scrollY = 0; return n; } // same address = reload, no new entry
  n.entries = n.entries.slice(0, n.cursor + 1); // forward is lost here
  n.entries.push({ ...t, scrollY: 0 });
  n.cursor = n.entries.length - 1;
  return n;
}
export function back(s: NavState, y: number): NavState | null {
  if (s.cursor <= 0) return null;
  const n = setScroll(s, y); n.cursor -= 1; return n;
}
export function forward(s: NavState, y: number): NavState | null {
  if (s.cursor >= s.entries.length - 1) return null;
  const n = setScroll(s, y); n.cursor += 1; return n;
}
