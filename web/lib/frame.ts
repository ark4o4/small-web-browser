// ---------------------------------------------------------------------------
// CONTAINMENT. Author HTML is untrusted markup rendered next to our own UI.
// Enforcement is done by the browser, in three independent layers:
//
//  1. <iframe sandbox="allow-scripts">  (see SiteFrame.tsx) - no allow-same-origin => opaque origin:
//     no cookies/storage/DOM access to the host app. No allow-top-navigation, allow-popups, allow-forms.
//  2. A CSP <meta> that is the FIRST thing in the document, so author markup cannot precede it:
//     default-src 'none' blocks every network/resource load; script-src allows only our nonce'd guard,
//     so author <script> and inline on* handlers do not run.
//  3. Our guard script lives in <head>, BEFORE author markup, so unclosed tags/comments in the author's
//     HTML cannot swallow it. It turns every link click into a postMessage; the iframe never navigates.
//
// Plus a best-effort strip of tags that can navigate or load things. It is defence in depth only:
// regex is not a sanitizer and nothing above relies on it.
//
// COST TO AUTHORS: no JavaScript, no forms, no images/fonts/external CSS (inline <style> works),
// no iframes/embeds, no <meta refresh>, no <base>. Text, headings, inline CSS and links work.
// ---------------------------------------------------------------------------
const STRIP = /<\s*(script|iframe|frame|frameset|object|embed|form|link|base|meta|noscript)\b[^>]*>([\s\S]*?<\s*\/\s*\1\s*>)?/gi;

function nonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const GUARD = `
var P = window.parent;
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest && e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  var h = a.getAttribute('href');
  if (h != null) P.postMessage({ tp: 'link', href: String(h).slice(0, 300) }, '*');
}, true);
document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
window.addEventListener('scroll', function () { P.postMessage({ tp: 'scroll', y: window.scrollY }, '*'); }, { passive: true });
window.addEventListener('message', function (e) {
  if (e.source === P && e.data && e.data.tp === 'restore') window.scrollTo(0, +e.data.y || 0);
});
window.addEventListener('load', function () { P.postMessage({ tp: 'ready' }, '*'); });
`;

const BASE_CSS = `body{font:16px/1.6 Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1.25rem;color:#1b1b1b}a{color:#0b57d0}`;

export function buildSrcdoc(authorHtml: string): string {
  const n = nonce();
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<script nonce="${n}">${GUARD}</script>` +
    `<style>${BASE_CSS}</style></head><body>${authorHtml.replace(STRIP, '')}</body></html>`;
}
