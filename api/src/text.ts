export function extractText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
export function snippet(text: string, query: string, width = 170): string {
  const low = text.toLowerCase();
  let at = -1;
  for (const raw of query.toLowerCase().replace(/["]/g, ' ').split(/\s+/)) {
    const term = raw.replace(/^-/, '');
    if (term.length < 2 || raw.startsWith('-')) continue;
    // Mongo stems ("tides" matches "tide"), so also try a trimmed form.
    for (const t of [term, term.slice(0, Math.max(3, term.length - 2))]) {
      const i = low.indexOf(t);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
  }
  const start = at < 0 ? 0 : Math.max(0, at - 60);
  return (start > 0 ? '…' : '') + text.slice(start, start + width) + (start + width < text.length ? '…' : '');
}
