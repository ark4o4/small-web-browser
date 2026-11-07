export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch('/api' + path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(Array.isArray(j?.message) ? j.message.join(', ') : j?.message ?? r.statusText);
  return j as T;
}
