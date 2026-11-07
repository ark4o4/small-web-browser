'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { NavView, Person, Via } from '../lib/types';
import SiteFrame from './SiteFrame';
import { History, Home, Publish, Results } from './Panels';

export default function Browser() {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<string>('');
  const [view, setView] = useState<NavView | null>(null);
  const [viewId, setViewId] = useState(0); // new id per response => frame/results remount, so restore-on-return always runs
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [bar, setBar] = useState('');
  const [q, setQ] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const scrollY = useRef(0);
  const busy = useRef(false); // one navigation at a time: client order == server order
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const viewRef = useRef<NavView | null>(null);

  const show = (v: NavView) => {
    viewRef.current = v; setView(v); setViewId((n) => n + 1);
    scrollY.current = v.current?.scrollY ?? 0;
    setBar(v.current?.kind === 'page' ? v.current.address : '');
    if (v.current?.kind === 'search') setQ(v.current.query);
  };

  useEffect(() => {
    api<Person[]>('/people').then((p) => {
      setPeople(p);
      setPersonId(localStorage.getItem('person') && p.some((x) => x.id === localStorage.getItem('person')) ? localStorage.getItem('person')! : p[0]?.id ?? '');
    }).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { // restore the person's navigation on load / person switch
    if (!personId) return;
    localStorage.setItem('person', personId);
    setView(null); viewRef.current = null;
    api<NavView>(`/people/${personId}/nav`).then(show).catch((e) => setError(e.message));
  }, [personId]);

  const run = useCallback(async (action: 'go' | 'back' | 'forward', body: object, label: string) => {
    if (!personId || busy.current) return;
    busy.current = true; clearTimeout(timer.current); setLoading(label); setError('');
    try { show(await api<NavView>(`/people/${personId}/nav/${action}`, { ...body, scrollY: scrollY.current })); }
    catch (e: any) { setError(e.message); }
    finally { busy.current = false; setLoading(null); }
  }, [personId]);

  const goPage = (address: string, via: Via) => run('go', { target: { kind: 'page', address: address.slice(0, 200) }, via }, address);
  const goSearch = (query: string) => query.trim() && run('go', { target: { kind: 'search', query }, via: 'search' }, query);

  const onScroll = (y: number) => { // keep the latest, and persist (debounced) so a reload restores it too
    scrollY.current = y; clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const v = viewRef.current; const c = v?.current;
      if (!v || !c) return;
      const key = c.kind === 'page' ? `page:${c.address}` : `search:${c.query}`;
      api(`/people/${personId}/nav/scroll`, { cursor: v.cursor, key, scrollY: y }).catch(() => {});
    }, 500);
  };

  const c = view?.current;
  const disabled = !!loading;
  return (
    <div className="app">
      <header className="chrome">
        <button disabled={disabled || !view?.canBack} onClick={() => run('back', {}, 'back')} title="Back">←</button>
        <button disabled={disabled || !view?.canForward} onClick={() => run('forward', {}, 'forward')} title="Forward">→</button>
        <form className="bar" onSubmit={(e) => { e.preventDefault(); goPage(bar, 'typed'); }}>
          <input value={bar} onChange={(e) => setBar(e.target.value)} placeholder="Type an address, e.g. tidepool.zz" aria-label="Address" disabled={disabled} />
        </form>
        <form className="search" onSubmit={(e) => { e.preventDefault(); goSearch(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every page" aria-label="Search" disabled={disabled} />
        </form>
        <button onClick={() => setShowHistory((s) => !s)}>History</button>
        <button onClick={() => setShowPublish(true)}>Publish</button>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Browsing as">
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </header>
      {loading && <div className="progress">Loading {loading}…</div>}
      {error && <div className="err banner">{error}</div>}
      <div className="body">
        <main className={loading ? 'main dim-out' : 'main'}>
          {view && !c && <Home onOpen={(a) => goPage(a, 'typed')} />}
          {c?.kind === 'page' && c.site && (
            <SiteFrame key={viewId} html={c.site.html} scrollY={c.scrollY}
              onLink={(h) => goPage(h, 'link')} onScroll={onScroll} />
          )}
          {c?.kind === 'page' && !c.site && (
            <div className="pane"><h1>{c.valid ? 'Nothing lives here' : 'Not an address'}</h1>
              <p><code>{c.address}</code> {c.valid ? 'has no site. The link may be old, or the page never existed.' : 'is not an address on this web.'}</p>
              <p className="dim">Back still works.</p></div>
          )}
          {c?.kind === 'search' && (
            <Results key={viewId} query={c.query} scrollY={c.scrollY} onScroll={onScroll} onOpen={(a) => goPage(a, 'search')} />
          )}
        </main>
        {showHistory && personId && <History personId={personId} refreshKey={viewId} onOpen={(a) => goPage(a, 'history')} />}
      </div>
      {showPublish && <Publish personId={personId} onClose={() => setShowPublish(false)}
        onDone={(a) => { setShowPublish(false); goPage(a, 'typed'); }} />}
    </div>
  );
}
