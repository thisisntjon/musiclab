// A module that fails leaves the page dead and silent: no app, no page error, and a screen whose controls do nothing.
// Slow loading and actual failure have different messages. Exercise the real inline controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../../../static/index.html', import.meta.url), 'utf8');
const WORDS = 'This did not load.';
// Development loads source; the published snapshot loads a content-addressed bundle.
// Both must keep the same error handler and load after the boot controller.
const appEntry = html.match(/<script type="module" src="(\.\/ui\/app(?:\.([a-f0-9]{64})\.bundle)?\.js)" onerror="musicLabBootFailed\(\)">/);


function boot() {
  const message = {textContent: ''}, buttonListeners = {};
  const shell = {inert: false}, timers = new Map(); let timerId = 0;
  const document = {activeElement:null};
  const entry = {focus() { document.activeElement = entry; }};
  const retry = {focusCount: 0, focus() { this.focusCount++; document.activeElement = retry; }, blur() { document.activeElement = null; }, addEventListener(type, fn) { buttonListeners[type] = fn; }};
  const box = { message, role:'alert', setAttribute(k,v) { this[k]=v; }, style: { display: '' } }, listeners = {};
  let reloads = 0;
  const window = { setTimeout(fn,ms) { timers.set(++timerId,{fn,ms}); return timerId; }, clearTimeout(id) { timers.delete(id); }, location: {reload() { reloads++; }}, addEventListener: (type, fn, capture) => { (listeners[type] ||= []).push({ fn, capture }); } };
  const script = html.match(/<script id="boot-check">([\s\S]*?)<\/script>/);
  assert.ok(script, 'the page carries its check before the app');
  document.getElementById = id => ({'boot-failed': box, 'boot-failed-message': message, 'boot-retry': retry})[id];
  document.querySelector = selector => selector === '.app-shell' ? shell : entry;
  vm.runInNewContext(script[1], { window, document });
  return { box, window, retry, shell, document, entry, timers, wait: () => { for (const [id,t] of [...timers]) { timers.delete(id); t.fn(); } }, click: () => buttonListeners.click(), reloads: () => reloads, fire: type => (listeners[type] || []).forEach(l => l.fn({ type })), listeners };
}
const shown = box => box.message.textContent === WORDS && box.style.display !== '' && box.style.display !== 'none';

test('the box is in the page, hidden, and spoken when filled', () => {
  const tag = html.match(/<div id="boot-failed"[^>]*>/)?.[0];
  assert.ok(tag, 'the box exists');
  assert.match(tag, /role="alert"/);
  assert.match(tag, /display:\s*none/, 'nothing shows until something has failed');
  assert.ok(html.indexOf('id="boot-failed"') < html.indexOf('id="boot-check"'), 'the box exists before its script runs');
  assert.ok(appEntry, 'source or hashed bundle keeps the boot failure handler');
  assert.ok(html.indexOf('id="boot-check"') < appEntry.index, 'the check is ready before the app can fail');
  const entryBytes = readFileSync(new URL('../../../static/' + appEntry[1], import.meta.url));
  if (appEntry[2]) assert.equal(createHash('sha256').update(entryBytes).digest('hex'), appEntry[2], 'bundle name matches its bytes');
});

test('a module that fails to fetch shows the words', () => {
  assert.ok(appEntry, 'source or hashed bundle keeps the boot failure handler');
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

test('a long wait offers a truthful status and retry without claiming failure or stealing focus', () => {
  const state = boot();
  assert.equal([...state.timers.values()][0].ms, 8000);
  state.wait();
  assert.equal(shown(state.box), false);
  assert.equal(state.box.role, 'status');
  assert.equal(state.box.style.display, 'flex');
  assert.equal(state.box.message.textContent, 'Still loading. You can wait or try again.');
  assert.equal(state.shell.inert, true);
  assert.equal(state.retry.focusCount, 0);
  assert.equal(state.reloads(), 0);
  state.click();
  assert.equal(state.reloads(), 1);
});

test('a real failure replaces waiting and cannot be downgraded by its timer', () => {
  const state = boot(); state.wait(); state.fire('error');
  assert.equal(state.box.role, 'alert'); assert.equal(shown(state.box), true);
  assert.equal(state.retry.focusCount, 1);
  state.wait(); assert.equal(shown(state.box), true);
});

test('successful app initialization clears waiting before window load and restores usable focus', () => {
  const state = boot(); state.wait(); state.retry.focus();
  state.window.musicLabApp = {};
  state.window.musicLabBootReady();
  assert.equal(state.box.style.display, 'none'); assert.equal(state.shell.inert, false);
  assert.equal(state.document.activeElement, state.entry);
  state.click(); assert.equal(state.reloads(), 0);
});

test('normal startup clears the timer without moving focus or showing a status', () => {
  const state = boot(); state.window.musicLabApp = {}; state.window.musicLabBootReady(); state.wait();
  assert.equal(state.timers.size, 0); assert.equal(state.box.style.display, 'none');
  assert.equal(state.document.activeElement, null); assert.equal(state.reloads(), 0);
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


test('failed boot offers one focused deliberate retry, never an automatic reload', () => {
  const state = boot();
  assert.equal(state.reloads(), 0);
  state.window.musicLabBootFailed();
  state.window.musicLabBootFailed();
  assert.equal(state.retry.focusCount, 1, 'repeated errors do not steal focus');
  assert.equal(state.reloads(), 0);
  state.click();
  assert.equal(state.reloads(), 1);
});

test('a stale retry button cannot reload a working song', () => {
  const state = boot();
  state.window.musicLabBootFailed();
  state.window.musicLabApp = {};
  state.click();
  assert.equal(state.reloads(), 0);
});
