// An address is the only thing typed in the bar and the only thing a link can say.
// Shape: host.zz or host.zz/path/segments. Anything else (https://..., ../x) is not an address.
const RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.zz(\/[a-z0-9._~-]+)*$/;
export function normalizeAddress(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase().replace(/^tp:\/\//, '').split('#')[0].replace(/\/+$/, '');
  return s.length <= 200 && RE.test(s) ? s : null;
}
