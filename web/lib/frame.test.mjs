import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSrcdoc } from './frame.ts';

const evil =
  `<h1>x</h1><script>top.location='https://evil.com'</script>` +
  `<meta http-equiv="refresh" content="0;url=https://evil.com"><base href="https://evil.com/">` +
  `<form action="x"><input></form><iframe src="https://evil.com"></iframe>` +
  `<a href="ghost.zz" onclick="alert(1)">ok</a><!-- never closed`;
const doc = buildSrcdoc(evil);
const authorStart = doc.indexOf('<h1>x</h1>');

test('CSP is the first policy in the document, before any author markup', () => {
  assert.ok(doc.indexOf('Content-Security-Policy') < authorStart);
  assert.match(doc, /default-src 'none'/);
  assert.match(doc, /script-src 'nonce-[0-9a-f]{32}'/);
  assert.doesNotMatch(doc, /unsafe-eval/);
});

test('the link guard is in <head>, before author markup', () => {
  assert.ok(doc.indexOf("addEventListener('click'") < authorStart);
  assert.ok(doc.indexOf('</head>') < authorStart);
});

test('navigating and loading tags are stripped from author markup', () => {
  const author = doc.slice(authorStart);
  for (const bad of ['<script', '<iframe', '<form', '<base', 'http-equiv'])
    assert.ok(!author.includes(bad), `${bad} should be stripped`);
});

test('links are kept so the guard can intercept them', () => {
  assert.ok(doc.includes('href="ghost.zz"'));
});

test('the nonce is different on every render', () => {
  const n = (d) => d.match(/nonce-([0-9a-f]{32})/)[1];
  assert.notEqual(n(buildSrcdoc('a')), n(buildSrcdoc('a')));
});