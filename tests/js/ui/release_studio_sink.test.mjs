// Open-release audit B1, every other place song text reaches the page: the hidden developer studio (static/ui/app.js
// renderAll) draws songDoc fields such as sections[].name as raw markup. In the play flow, app.songDoc is the song the
// person opened, and the backslash key redraws that studio, so an opened file could still put markup into the page.
// The whole app is built here with a stand-in page that records every innerHTML write.
//   node --test tests/js/ui/release_studio_sink.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportProjectJson } from '../../../static/js/theory/save_store.js';
import { newPlayDoc, recordAct } from '../../../static/js/theory/session_rules.js';

const written = [];
/** A stand-in element: any property is another element, innerHTML writes are recorded. The play flow's own root
 * answers queries with nothing, as an empty page would. */
function element(name) {
  const props = new Map();
  return new Proxy(function () {}, {
    get(_, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === 'then') return undefined;
      if (props.has(key)) return props.get(key);
      if (key === 'classList') {
        const set = new Set();
        const list = { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)), contains: c => set.has(c),
          toggle: (c, on) => { const v = on ?? !set.has(c); if (v) set.add(c); else set.delete(c); return v; } };
        props.set(key, list); return list;
      }
      if (key === 'style') { const style = { setProperty() {}, removeProperty() {} }; props.set(key, style); return style; }
      if (key === 'dataset') { const data = {}; props.set(key, data); return data; }
      if (key === 'children' || key === 'childNodes') return [];
      if (key === 'querySelectorAll' || key === 'getElementsByClassName') return () => [];
      if (key === 'closest' || (key === 'querySelector' && name === '#play-flow')) return () => null;
      if (key === 'value' || key === 'innerHTML' || key === 'textContent') return '';
      if (key === 'length') return 0;
      return element(`${name}.${String(key)}`);
    },
    set(_, key, value) { if (key === 'innerHTML' || key === 'outerHTML') written.push(String(value)); props.set(key, value); return true; },
    apply() { return element(`${name}()`); },
    construct() { return element(`new ${name}`); },
  });
}

async function buildApp() {
  const listeners = {};
  const body = element('body');
  const values = new Map();
  globalThis.document = { body, getElementById: id => element(`#${id}`), createElement: tag => element(tag), querySelector: () => element('query'),
    querySelectorAll: () => [], addEventListener() {}, documentElement: element('html'), activeElement: null, hidden: false };
  globalThis.window = {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, location: { search: '' },
    localStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), get length() { return values.size; }, key: () => null },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, requestAnimationFrame: () => 1, matchMedia: () => ({ matches: false, addEventListener() {} }),
    scrollX: 0, scrollY: 0, scrollTo() {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => globalThis.window.localStorage });
  globalThis.MutationObserver = class { observe() {} };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) }); // static hosting: no local server
  await import('../../../static/ui/app.js');
  for (const boot of listeners.DOMContentLoaded) boot();
  return { app: globalThis.window.musicLabApp, listeners, body };
}

const MARK = '<i data-xss="sections">x</i>';
let built;
test.before(async () => { built = await buildApp(); });
test.after(() => built?.app?._stopMusicDirector?.()); // its timer would keep this file running

test('an opened song with markup in a field the play flow keeps never reaches the page through the hidden studio', async () => {
  const { app, listeners, body } = built;
  assert.ok(app?.playFlow && body.classList.contains('pf-mode'), 'the app started in the play flow');
  const song = newPlayDoc(); song.title = 'Hidden studio';
  song.notes.push({ id: 'own', role: 'lead', step: 0, duration_steps: 2, velocity: .8, patch_id: 'pluck_lead', pitch_lock_mode: 'concrete', concrete: { midi_pitch: 64 }, provenance: 'user_placed' });
  recordAct(song, 'tap');
  song.sections = [{ id: 'verse', name: MARK, type: 'drop', energy: 1, active_roles: [] }];
  const text = exportProjectJson(song);
  await app.playFlow._importProjectFile({ size: text.length, text: async () => text });
  assert.equal(app.songDoc?.sections?.[0]?.name, MARK, 'the play flow hands the opened song to the app');
  written.length = 0;
  // The old backslash shortcut is gone (WCAG 2.1.4); drive the studio's own compile-and-redraw directly instead.
  await app.compileAndRefresh(false);
  await new Promise(resolve => setImmediate(resolve));
  app.renderAll();
  assert.equal(written.filter(html => html.includes('<i data-xss')).length, 0, 'no raw markup was written');
});

test('control: outside the play flow the studio does draw songs, so the check above sees its writes', async () => {
  const { app, body } = built;
  body.classList.remove('pf-mode');
  written.length = 0;
  await app.compileAndRefresh(false);
  app.renderAll();
  assert.ok(written.some(html => html.includes('section-title')), 'the studio drew its sections');
  assert.ok(written.some(html => html.includes('<i data-xss')), 'and in the studio a section name is still drawn as written');
  body.classList.add('pf-mode');
});
