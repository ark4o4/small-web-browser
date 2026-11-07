export function extractText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mongo stems words ("tides" matches "tide"), so try the term first, then plausible stems.
// Matches are whole-word, so a short stem like "tid" can't hit the middle of "Tidepool".
function forms(term: string): string[] {
  const out = [term];
  for (const suf of ['ing', 'es', 'ed', 's']) {
    if (term.endsWith(suf) && term.length - suf.length >= 3) out.push(term.slice(0, -suf.length));
  }
  return out;
}

export function snippet(text: string, query: string, width = 170): string {
  let at = -1;
  for (const raw of query.replace(/"/g, ' ').split(/\s+/)) {
    if (raw.startsWith('-')) continue;
    const term = raw.toLowerCase();
    if (term.length < 2) continue;
    for (const f of forms(term)) {
      const m = new RegExp('\\b' + esc(f) + '\\b', 'i').exec(text);
      if (m) { if (at < 0 || m.index < at) at = m.index; break; }
    }
  }
  const start = at < 0 ? 0 : Math.max(0, at - 60);
  return (start > 0 ? '…' : '') + text.slice(start, start + width) + (start + width < text.length ? '…' : '');
}