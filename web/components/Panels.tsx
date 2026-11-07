'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { HistoryItem } from '../lib/types';

export function Home({ onOpen }: { onOpen: (a: string) => void }) {
  const [sites, setSites] = useState<{ address: string; title: string; authorName: string }[]>([]);
  useEffect(() => { api<typeof sites>('/sites').then(setSites).catch(() => {}); }, []);
  return (
    <div className="pane">
      <h1>The small web</h1>
      <p>{sites.length} sites. Type an address above, search, or start somewhere:</p>
      <ul className="list">{sites.map((s) => (
        <li key={s.address}><a href="#" onClick={(e) => { e.preventDefault(); onOpen(s.address); }}>{s.title}</a> <span className="dim">{s.address} · {s.authorName}</span></li>
      ))}</ul>
    </div>
  );
}

export function Results({ query, scrollY, onScroll, onOpen }: {
  query: string; scrollY: number; onScroll: (y: number) => void; onOpen: (a: string) => void;
}) {
  const [res, setRes] = useState<{ address: string; title: string; authorName: string; snippet: string }[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const y0 = useRef(scrollY);
  useEffect(() => { api<{ results: NonNullable<typeof res> }>('/search?q=' + encodeURIComponent(query)).then((r) => setRes(r.results)); }, [query]);
  useEffect(() => { if (res && box.current) box.current.scrollTop = y0.current; }, [res]); // restore on return
  return (
    <div className="pane scroll" ref={box} onScroll={(e) => onScroll(e.currentTarget.scrollTop)}>
      <h2>Results for “{query}”</h2>
      {res === null ? <p className="dim">Searching…</p> : res.length === 0 ? <p>Nothing written anywhere matches that.</p> : (
        <ol className="results">{res.map((r) => (
          <li key={r.address}>
            <a href="#" onClick={(e) => { e.preventDefault(); onOpen(r.address); }}>{r.title}</a>
            <div className="dim">{r.address} · {r.authorName}</div>
            <div>{r.snippet}</div>
          </li>
        ))}</ol>
      )}
    </div>
  );
}

export function History({ personId, refreshKey, onOpen }: { personId: string; refreshKey: number; onOpen: (a: string) => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const load = async (before?: string) => {
    const r = await api<{ items: HistoryItem[]; next: string | null }>(`/people/${personId}/history?limit=40` + (before ? `&before=${encodeURIComponent(before)}` : ''));
    setItems((p) => (before ? [...p, ...r.items] : r.items)); setNext(r.next);
  };
  useEffect(() => { load().catch(() => {}); }, [personId, refreshKey]);
  return (
    <aside className="history">
      <h3>History</h3>
      <ul>{items.map((v) => (
        <li key={v.id} className={v.found ? '' : 'dead'}>
          <a href="#" onClick={(e) => { e.preventDefault(); onOpen(v.address); }}>{v.title ?? v.address}</a>
          <div className="dim">{v.found ? v.address : `${v.address} (nothing here)`}</div>
          <div className="dim">{new Date(v.at).toLocaleString()} · via {v.via}</div>
        </li>
      ))}</ul>
      {next && <button onClick={() => load(next)}>Older…</button>}
    </aside>
  );
}

const TEMPLATE = `<h1>My page</h1>\n<p>Write something. Link to <a href="tidepool.zz">another site</a>.</p>`;
export function Publish({ personId, onDone, onClose }: { personId: string; onDone: (a: string) => void; onClose: () => void }) {
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState(TEMPLATE);
  const [err, setErr] = useState('');
  const submit = async () => {
    try { const r = await api<{ address: string }>('/sites', { address, title, html, authorId: personId }); onDone(r.address); }
    catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="modal"><div className="card">
      <h3>Publish a site</h3>
      <label>Address <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="mysite.zz" /></label>
      <label>Title <input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>HTML <textarea rows={9} value={html} onChange={(e) => setHtml(e.target.value)} /></label>
      <p className="dim">Pages run sandboxed: text, inline CSS and links only. No scripts, forms or external resources.</p>
      {err && <p className="err">{err}</p>}
      <div className="row"><button onClick={submit}>Publish</button><button onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}
