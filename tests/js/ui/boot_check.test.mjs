// A module that fails leaves the page dead and silent: no app, no page error, and a screen whose controls do nothing.
// The check in index.html says so, and only then. A slow load must never see it. Run the page's own script against a stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../../static/index.html', import.meta.url), 'utf8');
const WORDS = 'This did not load. Reload the page.';

function boot() {
  const box = { textContent: '', style: { display: '' } }, listeners = {};
  const window = { addEventListener: (type, fn, capture) => { (listeners[type] ||= []).push({ fn, capture }); } };
  const script = html.match(/<script id="boot-check">([\s\S]*?)<\/script>/);
  assert.ok(script, 'the page carries its check before the app');
  vm.runInNewContext(script[1], { window, document: { getElementById: id => id === 'boot-failed' ? box : null } });
  return { box, window, fire: type => (listeners[type] || []).forEach(l => l.fn({ type })), listeners };
}
const shown = box => box.textContent === WORDS && box.style.display !== '' && box.style.display !== 'none';

test('the box is in the page, hidden, and spoken when filled', () => {
  const tag = html.match(/<div id="boot-failed"[^>]*>/)?.[0];
  assert.ok(tag, 'the box exists');
  assert.match(tag, /role="alert"/);
  assert.match(tag, /display:\s*none/, 'nothing shows until something has failed');
  assert.ok(html.indexOf('id="boot-failed"') < html.indexOf('id="boot-check"'), 'the box exists before its script runs');
  assert.ok(html.indexOf('id="boot-check"') < html.indexOf('src="./ui/app.js"'), 'the check is ready before the app can fail');
});

test('a module that fails to fetch shows the words', () => {
  assert.match(html, /<script type="module" src="\.\/ui\/app\.js" onerror="musicLabBootFailed\(\)">/);
  const { box, window } = boot();
  assert.equal(shown(box), false);
  window.musicLabBootFailed();
  assert.equal(shown(box), true);
});

test('code that throws before the app exists shows the words', () => {
  const { box, fire } = boot();
  fire('error');
  assert.equal(shown(box), true);
});

test('time alone never shows them: no timer, so a slow phone never sees it', () => {
  const script = html.match(/<script id="boot-check">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(script, /setTimeout|setInterval|requestAnimationFrame/);
  const { box, fire } = boot();
  fire('DOMContentLoaded');
  assert.equal(shown(box), false);
});

test('a stylesheet or image that fails does not: only thrown errors reach the listener', () => {
  const { listeners } = boot();
  assert.ok(listeners.error.length > 0);
  for (const { capture } of listeners.error) assert.ok(!capture, 'resource errors reach window only by capture');
});

test('once the app has started, a later error says nothing', () => {
  const { box, window, fire } = boot();
  window.musicLabApp = {};
  fire('error');
  window.musicLabBootFailed();
  assert.equal(shown(box), false);
});

test('an early stray error is taken back if the app starts after all', () => {
  const { box, window, fire } = boot();
  fire('error');
  assert.equal(shown(box), true);
  window.musicLabApp = {};
  fire('load');
  assert.equal(box.style.display, 'none');
});
