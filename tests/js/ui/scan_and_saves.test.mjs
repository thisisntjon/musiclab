// Phase 9a-9 (saves never overwrite; only the person's pieces listed) and the scanning model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlayFlow } from "../../../static/ui/stages/play_flow.js";
import { createScan, scanNext, scanResync } from "../../../static/js/theory/scan_model.js";
import {
  listSaves,
  savePiece,
  loadPiece,
  replacePiece,
  deletePiece,
  confirmPress,
  summarizeCartridge,
  listPhraseShelf,
  savePhraseToShelf,
  applyPhraseFromShelf,
  stashWorkingSong,
  loadWorkingSong,
  clearWorkingSong,
  exportProjectJson,
  parseProjectJson,
  SLOT_COUNT,
} from "../../../static/js/theory/save_store.js";
import { newPlayDoc } from "../../../static/js/theory/session_rules.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = String(v)), data };
}

test("navigation and arrangement choices do not start sound", async () => {
  const flow = Object.create(PlayFlow.prototype);
  flow.doc = newPlayDoc();
  flow.doc.song_cards = [{ beat: true, tune: true, under: true }];
  flow.confirm = {};
  flow.app = { scheduler: { unlock: async () => {}, previewBar: () => assert.fail("unexpected sound") }, _announce() {} };
  flow._compile = () => {};
  flow._pushUndo = () => {};
  flow._go = () => {};
  flow.render = () => {};
  for (const key of ["to-tune", "to-under", "to-song", "keep", "add-card", "card-big:0", "name:My song"]) {
    await flow._onClick({ target: { closest: () => ({ dataset: { key }, focus() {} }) } });
  }
});

test("scanning moves one item per press and wraps; nothing moves on its own", () => {
  const scan = createScan();
  assert.deepEqual([1, 2, 3, 4].map(() => scanNext(scan, 3)), [0, 1, 2, 0]);
  assert.equal(scanNext(scan, 0), -1);
  assert.equal(scanResync(scan, 2, 5), -1);
});

test("Enter uses visible focus after Tab or pointer focus, not a stale scan index", () => {
  let oldClicks = 0, focusedClicks = 0;
  const old = { dataset: { key: "note:0:60" }, click: () => oldClicks++ };
  const focused = { tagName: "BUTTON", dataset: { key: "capture-direction" }, click: () => focusedClicks++ };
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: focused, getElementById: () => null };
  try {
    const flow = Object.create(PlayFlow.prototype);
    flow.root = { style: {}, contains: () => true };
    flow.scan = { index: 0 };
    flow._scanItems = () => [old, focused];
    flow._onKey({ key: "Enter", preventDefault() {}, stopImmediatePropagation() {} });
    assert.equal(oldClicks, 0);
    assert.equal(focusedClicks, 1);
  } finally { globalThis.document = previousDocument; }
});

test("Enter in a text field never activates the previous scan control", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { activeElement: { tagName: "INPUT", type: "text" }, getElementById: () => null };
  try {
    const flow = Object.create(PlayFlow.prototype);
    flow.root = { style: {}, contains: () => true };
    flow.scan = { index: 0 };
    flow._scanItems = () => [{ click: () => assert.fail("changed music while typing") }];
    flow._onKey({ key: "Enter", preventDefault: () => assert.fail("intercepted text input") });
  } finally { globalThis.document = previousDocument; }
});

test("9a-9: two saved pieces both survive", () => {
  const storage = memoryStorage();
  const a = newPlayDoc();
  a.title = "First";
  const b = newPlayDoc();
  b.title = "Second";
  savePiece(storage, a);
  savePiece(storage, b);
  assert.deepEqual(listSaves(storage).map((s) => s.title).sort(), ["First", "Second"]);
  assert.equal(loadPiece(storage, a.id).title, "First");
});

test("9a-9: songs the old guide stored (including the test song) are never listed as the person's", () => {
  // The old guide wrote to "tonecanvas_saved_songs", and the server listed "fix_my_loop_demo" as a saved song.
  const storage = memoryStorage({
    tonecanvas_saved_songs: JSON.stringify([{ id: "fix_my_loop_demo", title: "Diagnostic Challenge — Fix My Loop", song: {} }]),
  });
  assert.deepEqual(listSaves(storage), []);
});

test("9b-6: 6 slots; a 7th piece is refused rather than pushing an old one out", () => {
  const storage = memoryStorage();
  const ids = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const d = newPlayDoc();
    d.title = `Piece ${i}`;
    ids.push(d.id);
    assert.equal(savePiece(storage, d).ok, true);
  }
  assert.equal(SLOT_COUNT, 6);
  const seventh = newPlayDoc();
  const res = savePiece(storage, seventh);
  assert.deepEqual([res.ok, res.reason], [false, "slots_full"]);
  assert.deepEqual(listSaves(storage).map((s) => s.id), ids); // nothing dropped, order kept
  // saving one of the 6 again still works (it updates its own slot)
  const again = loadPiece(storage, ids[2]);
  again.title = "Renamed";
  assert.equal(savePiece(storage, again).ok, true);
  assert.equal(listSaves(storage)[2].title, "Renamed");
});

test("9b-6: replacing or deleting needs a second press on the same thing", () => {
  const storage = memoryStorage();
  const docs = [0, 1, 2, 3, 4, 5].map((i) => Object.assign(newPlayDoc(), { title: `P${i}` }));
  docs.forEach((d) => savePiece(storage, d));
  const press = { armed: null };
  assert.equal(confirmPress(press, `delete:${docs[0].id}`), false); // first press only arms
  assert.equal(listSaves(storage).length, 6);
  assert.equal(confirmPress(press, `delete:${docs[1].id}`), false); // a different piece re-arms, deletes nothing
  assert.equal(confirmPress(press, `delete:${docs[1].id}`), true); // second press on the same one confirms
  assert.equal(deletePiece(storage, docs[1].id).ok, true);
  assert.deepEqual(listSaves(storage).map((s) => s.title), ["P0", "P2", "P3", "P4", "P5"]);

  savePiece(storage, Object.assign(newPlayDoc(), { title: "P6" })); // fills the free slot
  const newcomer = Object.assign(newPlayDoc(), { title: "New" });
  assert.equal(savePiece(storage, newcomer).reason, "slots_full");
  assert.equal(replacePiece(storage, docs[3].id, newcomer).ok, true);
  assert.deepEqual(listSaves(storage).map((s) => s.title), ["P0", "P2", "New", "P4", "P5", "P6"]);
});

test("9a-9: only pieces the person made are listed, even in the play flow's own store", () => {
  const storage = memoryStorage({
    "musiclab.saves.v1": JSON.stringify([
      { id: "fix_my_loop_demo", source: "preset", title: "Fix My Loop", song: {} },
      { id: "starter", title: "No source", song: {} },
      { id: "mine", source: "person", title: "Mine", song: { id: "mine" } },
    ]),
  });
  assert.deepEqual(listSaves(storage).map((s) => s.id), ["mine"]);
});

test("9a-9: when the device is full, saving fails honestly and removes nothing", () => {
  const storage = memoryStorage();
  const first = newPlayDoc();
  savePiece(storage, first);
  const full = { getItem: storage.getItem, setItem: () => { throw new Error("QuotaExceededError"); } };
  const res = savePiece(full, newPlayDoc());
  assert.equal(res.ok, false);
  assert.equal(res.reason, "full");
  assert.deepEqual(listSaves(storage).map((s) => s.id), [first.id]);
});

test("saving the same piece again updates it in place", () => {
  const storage = memoryStorage();
  const a = newPlayDoc();
  savePiece(storage, a);
  a.title = "Renamed";
  savePiece(storage, a);
  assert.deepEqual(listSaves(storage).map((s) => s.title), ["Renamed"]);
});


test("all PlayFlow and selftest ES modules link and export cleanly", async () => {
  const pf = await import("../../../static/ui/stages/play_flow.js");
  const st = await import("../../../static/ui/selftest.js");
  const pa = await import("../../../static/ui/page_audit.js");
  assert.equal(typeof pf.PlayFlow, "function");
  assert.equal(typeof st.runSelfTest, "function");
  assert.equal(typeof pa.auditRoot, "function");
});

test("12e-3 (#17): savePiece attaches cartridge badge summary (kit, feel, parts, notes)", () => {
  const storage = memoryStorage();
  const doc = newPlayDoc();
  doc.title = "Cartridge Song";
  doc.drum_kit = "tiny";
  doc.underneath = { feel: "floating" };
  doc.song_cards = [{ beat: true, tune: true, under: true }, { beat: true, tune: false, under: true }];
  doc.notes.push({ id: "lead-0", step: 0, role: "lead", provenance: "user_placed", concrete: { midi_pitch: 60 } });
  const res = savePiece(storage, doc);
  assert.equal(res.ok, true);
  assert.deepEqual(res.entry.cartridge, { kit: "tiny", feel: "floating", parts: 2, notes: 1 });
  assert.deepEqual(summarizeCartridge(doc), { kit: "tiny", feel: "floating", parts: 2, notes: 1 });
});

test("fun-wave-2 #1: stashWorkingSong and loadWorkingSong persist the active song where you left it", () => {
  const storage = memoryStorage();
  const doc = newPlayDoc();
  doc.title = "In Progress";
  assert.equal(stashWorkingSong(storage, doc), true);
  const loaded = loadWorkingSong(storage);
  assert.ok(loaded);
  assert.equal(loaded.id, doc.id);
  assert.equal(loaded.title, "In Progress");
  clearWorkingSong(storage);
  assert.equal(loadWorkingSong(storage), null);
});

test("fun-wave-2 #10: exportProjectJson and parseProjectJson round-trip a song forever", () => {
  const doc = newPlayDoc();
  doc.title = "Forever Song";
  doc.drum_kit = "soft";
  const jsonText = exportProjectJson(doc);
  const parsed = parseProjectJson(jsonText);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.song.id, doc.id);
  assert.equal(parsed.song.title, "Forever Song");
  assert.equal(parsed.song.drum_kit, "soft");
  assert.equal(parseProjectJson("not-json").ok, false);
  assert.equal(parseProjectJson("{}").ok, false);
});

test("12f-3 (Proposals #3 & #9): savePhraseToShelf and applyPhraseFromShelf reuse a phrase across keys", () => {
  const storage = memoryStorage();
  const docA = newPlayDoc();
  docA.global_context.root_pc = 0; // C
  docA.notes.push(
    { id: "lead-0", step: 0, duration_steps: 2, role: "lead", provenance: "user_placed", concrete: { midi_pitch: 60 } },
    { id: "lead-4", step: 4, duration_steps: 2, role: "lead", provenance: "user_placed", concrete: { midi_pitch: 64 } }
  );
  const saved = savePhraseToShelf(storage, docA, { title: "Opening Motif" });
  assert.equal(saved.ok, true);
  assert.equal(listPhraseShelf(storage).length, 1);

  // Reuse in a piece in G (root_pc = 7 -> +5 or -5 semitone adaptation: +7 folds to -5 so 60->55, 64->59)
  const docB = newPlayDoc();
  docB.global_context.root_pc = 7;
  const applied = applyPhraseFromShelf(docB, listPhraseShelf(storage)[0]);
  const leadB = applied.notes.filter((n) => n.role === "lead");
  assert.equal(leadB.length, 2);
  assert.deepEqual(
    leadB.map((n) => n.id),
    ["lead-0", "lead-4"]
  );
  assert.deepEqual(
    leadB.map((n) => n.concrete.midi_pitch),
    [55, 59]
  );
});

test('Enter on the field never activates a stale scan choice',()=>{
 const previous=globalThis.document;
 globalThis.document={activeElement:{tagName:'DIV',matches:selector=>selector==='[data-music-field]'},getElementById:()=>null};
 try{
  const flow=Object.create(PlayFlow.prototype);flow.root={style:{}};flow.scan={index:0};
  flow._scanItems=()=>[{click:()=>assert.fail('stale field action')}];
  flow._onKey({key:'Enter',preventDefault(){},stopImmediatePropagation(){}});
 }finally{globalThis.document=previous;}
});

test('unreadable libraries refuse every mutation without overwriting original bytes',()=>{
 for(const raw of['','{','null','{}','[null]','[{"id":3}]']){
  let writes=0;const storage={getItem:()=>raw,setItem:()=>writes++};const song=newPlayDoc();
  assert.equal(savePiece(storage,song).reason,'unreadable');
  assert.equal(replacePiece(storage,'old',song).reason,'unreadable');
  assert.equal(deletePiece(storage,'old').reason,'unreadable');
  assert.equal(writes,0);
 }
 const storage={getItem(){throw Error('unavailable')},setItem(){assert.fail('must not write')}};
 assert.equal(savePiece(storage,newPlayDoc()).reason,'unreadable');
});


test('entering the connected field maps old coordinates instead of jumping to the middle',async()=>{
 const {newPlayDoc}=await import('../../../static/js/theory/session_rules.js');
 const {startJam,setJamDirection}=await import('../../../static/js/theory/jam_session.js');
 for(const version of[2,3])for(const x of[0,.23,1]){
  const doc=setJamDirection(startJam(newPlayDoc()),{music_field:{version,x,y:.73}});
  const f=Object.assign(Object.create(PlayFlow.prototype),{doc,stage:'jam',confirm:{armed:null},root:{querySelector:()=>({focus(){}})},app:{scheduler:{stopGeneration:1}},_pushUndo(){},_acceptJamDoc(d){this.doc=d},render(){}});
  await f._onClick({target:{closest:()=>({dataset:{key:'field-connected'},focus(){}})}});
  assert.deepEqual(f.doc.jam_session.music_field,{version:4,x:version===2?.4+.6*x:.2*(1-x),y:.73});
 }
});
