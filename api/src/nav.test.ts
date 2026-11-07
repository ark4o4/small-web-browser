import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyNav, go, back, forward } from './nav';
import type { NavState } from './nav';
import { normalizeAddress } from './address';
import { extractText, snippet } from './text';

const page = (address: string) => ({ kind: 'page' as const, address });
const at = (s: NavState) => s.entries[s.cursor];

test('trail four deep, back across it, forward across it', () => {
  let s = emptyNav();
  for (const a of ['a.zz', 'b.zz', 'c.zz', 'd.zz']) s = go(s, page(a), 0);
  assert.equal(s.entries.length, 4);
  for (let i = 0; i < 3; i++) s = back(s, 0)!;
  assert.equal((at(s) as any).address, 'a.zz');
  assert.equal(back(s, 0), null);
  for (let i = 0; i < 3; i++) s = forward(s, 0)!;
  assert.equal((at(s) as any).address, 'd.zz');
  assert.equal(forward(s, 0), null);
});

test('forward is lost on new navigation', () => {
  let s = emptyNav();
  for (const a of ['a.zz', 'b.zz', 'c.zz']) s = go(s, page(a), 0);
  s = back(s, 0)!; s = back(s, 0)!;
  s = go(s, page('x.zz'), 0);
  assert.deepEqual(s.entries.map((e: any) => e.address), ['a.zz', 'x.zz']);
  assert.equal(forward(s, 0), null);
});

test('restore on return: the page left is the page found, at its scroll', () => {
  let s = go(emptyNav(), { kind: 'search', query: 'tides' }, 0);
  s = go(s, page('a.zz'), 480);
  s = go(s, page('b.zz'), 90);
  s = back(s, 0)!; assert.equal(at(s).scrollY, 90);
  s = back(s, 90)!; // reader hasn't scrolled since restore
  assert.equal(at(s).kind, 'search'); assert.equal(at(s).scrollY, 480);
  s = forward(s, 480)!; assert.equal(at(s).scrollY, 90);
});

test('same address is a reload, not a new entry', () => {
  let s = go(emptyNav(), page('a.zz'), 0);
  s = go(s, page('a.zz'), 300);
  assert.equal(s.entries.length, 1);
});

test('go/back/forward never mutate their input', () => {
  const s0 = go(emptyNav(), page('a.zz'), 0);
  const snap = JSON.stringify(s0);
  go(s0, page('b.zz'), 5); back(s0, 5); forward(s0, 5);
  assert.equal(JSON.stringify(s0), snap);
});

test('addresses', () => {
  assert.equal(normalizeAddress(' TidePool.zz/ '), 'tidepool.zz');
  assert.equal(normalizeAddress('tp://a.zz/x#frag'), 'a.zz/x');
  for (const bad of ['https://evil.com', 'javascript:alert(1)', '../x', 'a.com', '', 'a.zz//b', 'a.zz/<b>'])
    assert.equal(normalizeAddress(bad), null, bad);
});

test('text extraction and snippets', () => {
  const t = extractText('<h1>Hi</h1><script>evil()</script><p>The tide &amp; the moon</p>');
  assert.equal(t, 'Hi The tide & the moon');
  assert.match(snippet(t, 'tides'), /tide/);
});
