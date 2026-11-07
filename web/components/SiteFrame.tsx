'use client';
import { useEffect, useMemo, useRef } from 'react';
import { buildSrcdoc } from '../lib/frame';

export default function SiteFrame({ html, scrollY, onLink, onScroll }: {
  html: string; scrollY: number; onLink: (href: string) => void; onScroll: (y: number) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const initialY = useRef(scrollY); // captured at mount; parent re-keys this component per view
  const srcDoc = useMemo(() => buildSrcdoc(html), [html]);
  const cb = useRef({ onLink, onScroll });
  cb.current = { onLink, onScroll };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return; // only our own frame; origin is "null" so identity is the check
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.tp === 'link' && typeof d.href === 'string') cb.current.onLink(d.href);
      else if (d.tp === 'scroll' && typeof d.y === 'number' && isFinite(d.y)) cb.current.onScroll(Math.max(0, d.y));
      else if (d.tp === 'ready') ref.current?.contentWindow?.postMessage({ tp: 'restore', y: initialY.current }, '*');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // sandbox: scripts only (our guard, enforced by CSP). No same-origin, top-navigation, popups, forms.
  return <iframe ref={ref} className="frame" title="page" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} />;
}
