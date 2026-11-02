/**
 * The sheet (phase 13.6a): the same music as real notation, kept in step with the app.
 *
 * `scoreFromEvents` turns what plays (compiled events) into measures of notes on staves,
 * one staff per part: tune and chords in treble, bass in bass clef, drums on a percussion
 * staff. `toMusicXML` writes a standard MusicXML file that MuseScore and others open, and
 * `fromMusicXML` reads one back (our own, or an edited one) into MusicLab notes. `renderSheetSvg`
 * draws the score with the app's part colours, a playhead and the person's notes outlined.
 *
 * Import-free so it runs in Node tests and the browser. Durations are quantised to the
 * 16th-note grid the app already uses; nothing finer exists in the music.
 */

export const DIVISIONS = 4; // divisions per quarter note: one per 16th step
export const SHEET_PARTS = [
  { id: "tune", label: "Tune", clef: "G", roles: ["lead"] },
  { id: "chords", label: "Chords", clef: "G", roles: ["harmony", "hocket"] },
  { id: "bass", label: "Bass", clef: "F", roles: ["bass"] },
  { id: "drums", label: "Drums", clef: "percussion", roles: ["drums"] },
];
const OWN = new Set(["user_placed", "hummed_confirmed"]);
// Standard drum-set placement on a five-line percussion staff.
const DRUM_LINES = { kick: ["F", 4, "normal"], snare: ["C", 5, "normal"], clap: ["C", 5, "x"], hat_closed: ["G", 5, "x"], hat_open: ["G", 5, "circle-x"], perc: ["A", 5, "x"] };
const DRUM_MIDI = { kick: 36, snare: 38, clap: 39, hat_closed: 42, hat_open: 46, perc: 45 };
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MAJOR_FIFTHS = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 5: -1, 10: -2, 3: -3, 8: -4, 1: -5 };
const TYPES = [[16, "whole", 0], [12, "half", 1], [8, "half", 0], [6, "quarter", 1], [4, "quarter", 0], [3, "eighth", 1], [2, "eighth", 0], [1, "16th", 0]];

export function keySignature(rootPc = 0, scaleType = "major") {
  const mode = /minor|dorian|phrygian|aeolian/.test(String(scaleType)) ? "minor" : "major";
  const major = mode === "minor" ? (rootPc + 3) % 12 : rootPc % 12;
  const fifths = MAJOR_FIFTHS[major] ?? 0;
  return { fifths, mode, root: rootPc % 12, flats: fifths < 0 };
}

export function spellPitch(midi, flats = false) {
  const pc = ((midi % 12) + 12) % 12, name = (flats ? FLATS : SHARPS)[pc];
  return { step: name[0], alter: name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0, octave: Math.floor(midi / 12) - 1 };
}

/** The largest standard note value that fits, so every note has a drawable type. */
export function noteType(steps) {
  const n = Math.max(1, Math.round(steps));
  const hit = TYPES.find(([len]) => len <= n) || TYPES.at(-1);
  return { steps: hit[0], type: hit[1], dots: hit[2] };
}

const partFor = role => SHEET_PARTS.find(p => p.roles.includes(role))?.id || null;

/** Measures of monophonic-per-part voices (chords stack at one onset), with rests filled in. */
export function scoreFromEvents(events, { title = "My song", bpm = 100, rootPc = 0, scaleType = "major", stepsPerBar = 16, totalSteps = null } = {}) {
  const list = (events || []).filter(e => e && Number.isInteger(Math.round(e.step)) && (e.velocity ?? 1) > 0 && partFor(e.role));
  const last = totalSteps ?? (list.length ? Math.max(...list.map(e => Math.round(e.step) + 1)) : stepsPerBar);
  const bars = Math.max(1, Math.ceil(last / stepsPerBar));
  const key = keySignature(rootPc, scaleType);
  const beats = stepsPerBar / 4;
  const measures = [];
  for (let m = 0; m < bars; m++) {
    const measure = { number: m + 1, parts: {} };
    for (const part of SHEET_PARTS) {
      const start = m * stepsPerBar, end = start + stepsPerBar;
      const own = list.filter(e => partFor(e.role) === part.id && Math.round(e.step) >= start && Math.round(e.step) < end)
        .sort((a, b) => a.step - b.step || (a.concrete?.midi_pitch ?? 0) - (b.concrete?.midi_pitch ?? 0));
      const onsets = [...new Set(own.map(e => Math.round(e.step)))];
      const items = [];
      let cursor = start;
      onsets.forEach((onset, i) => {
        if (onset > cursor) items.push(...rests(cursor, onset - cursor, start));
        const next = onsets[i + 1] ?? end;
        const stack = own.filter(e => Math.round(e.step) === onset);
        const wanted = Math.max(1, Math.round(Math.max(...stack.map(e => Number(e.duration_steps) || 1))));
        const dur = part.id === "drums" ? 1 : Math.min(wanted, next - onset, end - onset);
        const { steps, type, dots } = noteType(dur);
        items.push({ kind: "note", step: onset - start, steps, type, dots, notes: stack.map(e => ({
          id: e.id, midi: Number(e.concrete?.midi_pitch ?? e.concrete?.midi ?? (part.id === "drums" ? DRUM_MIDI[e.patch_id] ?? 38 : 60)),
          patch: e.patch_id || null, own: OWN.has(e.provenance), velocity: e.velocity ?? .8 })) });
        cursor = onset + steps;
      });
      if (cursor < end) items.push(...rests(cursor, end - cursor, start));
      measure.parts[part.id] = items;
    }
    measures.push(measure);
  }
  const used = SHEET_PARTS.filter(p => measures.some(m => m.parts[p.id].some(i => i.kind === "note"))).map(p => p.id);
  return { title, bpm, key, time: { beats, beatType: 4 }, stepsPerBar, measures, parts: used.length ? used : ["tune"] };
}

function rests(from, length, barStart) {
  const out = [];
  let at = from, left = length;
  while (left > 0) {
    const { steps, type, dots } = noteType(left);
    out.push({ kind: "rest", step: at - barStart, steps, type, dots });
    at += steps; left -= steps;
  }
  return out;
}

const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toMusicXML(score) {
  const parts = score.parts.map(id => SHEET_PARTS.find(p => p.id === id));
  const ownIds = score.measures.flatMap(m => Object.values(m.parts).flatMap(items => items.flatMap(i => (i.notes || []).filter(n => n.own).map(n => n.id))));
  const partList = parts.map(p => `    <score-part id="P-${p.id}"><part-name>${xml(p.label)}</part-name></score-part>`).join("\n");
  const body = parts.map(p => {
    const measures = score.measures.map((m, mi) => {
      const attrs = mi === 0 ? `      <attributes><divisions>${DIVISIONS}</divisions><key><fifths>${score.key.fifths}</fifths><mode>${score.key.mode}</mode></key>` +
        `<time><beats>${score.time.beats}</beats><beat-type>${score.time.beatType}</beat-type></time>` +
        (p.clef === "percussion" ? `<clef><sign>percussion</sign><line>2</line></clef>` : `<clef><sign>${p.clef}</sign><line>${p.clef === "F" ? 4 : 2}</line></clef>`) +
        `</attributes>\n` + (p === parts[0] ? `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(score.bpm)}</per-minute></metronome></direction-type><sound tempo="${Math.round(score.bpm)}"/></direction>\n` : "") : "";
      const items = m.parts[p.id].map(item => {
        const dur = item.steps, dots = "<dot/>".repeat(item.dots);
        if (item.kind === "rest") return `      <note><rest/><duration>${dur}</duration><type>${item.type}</type>${dots}</note>`;
        return item.notes.map((n, i) => {
          const pitch = p.clef === "percussion"
            ? (() => { const [s, o, head] = DRUM_LINES[n.patch] || DRUM_LINES.snare; return `<unpitched><display-step>${s}</display-step><display-octave>${o}</display-octave></unpitched>`; })()
            : (() => { const { step, alter, octave } = spellPitch(n.midi, score.key.flats); return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`; })();
          const head = p.clef === "percussion" && (DRUM_LINES[n.patch] || [])[2] && DRUM_LINES[n.patch][2] !== "normal" ? `<notehead>${DRUM_LINES[n.patch][2]}</notehead>` : "";
          const instrument = p.clef === "percussion" ? `<instrument id="P-drums-${xml(n.patch || "snare")}"/>` : "";
          return `      <note${n.id ? ` id="${xml(n.id)}"` : ""}${n.own ? ` color="#FF2BD6"` : ""}>${i ? "<chord/>" : ""}${pitch}<duration>${dur}</duration>${instrument}<type>${item.type}</type>${dots}${head}</note>`;
        }).join("\n");
      }).join("\n");
      return `    <measure number="${m.number}">\n${attrs}${items}\n    </measure>`;
    }).join("\n");
    return `  <part id="P-${p.id}">\n${measures}\n  </part>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "${"http:"}//www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${xml(score.title)}</work-title></work>
  <identification><encoding><software>MusicLab</software></encoding>
    <miscellaneous><miscellaneous-field name="musiclab-steps-per-bar">${score.stepsPerBar}</miscellaneous-field><miscellaneous-field name="musiclab-own-notes">${xml(ownIds.join(" "))}</miscellaneous-field></miscellaneous></identification>
  <part-list>
${partList}
  </part-list>
${body}
</score-partwise>
`;
}

/* ---- a small XML reader: enough for MusicXML we wrote or that a notation program saved ---- */
export function parseXml(text) {
  const src = String(text).replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/i, "").replace(/<!--[\s\S]*?-->/g, "");
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const tag = /<\/?([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = tag.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) { top.text += m[4]; continue; }
    if (m[0].startsWith("</")) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    for (const a of m[2].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
    const node = { name: m[1], attrs, children: [], text: "" };
    top.children.push(node);
    if (!m[3]) stack.push(node);
  }
  return root;
}
const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const child = (n, name) => n?.children.find(c => c.name === name);
const kids = (n, name) => n?.children.filter(c => c.name === name) || [];
const textOf = (n, name) => decode(child(n, name)?.text.trim() ?? "");
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DRUM_FROM_LINE = { "F4": "kick", "C5": "snare", "G5": "hat_closed", "A5": "perc", "E4": "kick", "D5": "snare" };

/** MusicXML back into MusicLab notes: {title, bpm, root_pc, scale_type, steps_per_bar, notes, bars}. */
export function fromMusicXML(text) {
  const doc = parseXml(text);
  const score = child(doc, "score-partwise");
  if (!score) return { ok: false, reason: "not-musicxml" };
  const partNames = Object.fromEntries(kids(child(score, "part-list"), "score-part").map(sp => [sp.attrs.id, textOf(sp, "part-name").toLowerCase()]));
  const ownIds = new Set((kids(child(child(score, "identification"), "miscellaneous"), "miscellaneous-field").find(f => f.attrs.name === "musiclab-own-notes")?.text || "").split(/\s+/).filter(Boolean));
  const notes = [];
  let bpm = 100, fifths = 0, mode = "major", beats = 4, divisions = DIVISIONS, totalSteps = 0, counter = 0;
  for (const part of kids(score, "part")) {
    const label = partNames[part.attrs.id] || "";
    let clef = "G", stepCursor = 0;
    const roleFromClef = () => clef === "percussion" ? "drums" : clef === "F" ? "bass" : /chord|harmon|piano|keys/.test(label) ? "harmony" : "lead";
    for (const measure of kids(part, "measure")) {
      const attrs = child(measure, "attributes");
      if (attrs) {
        if (textOf(attrs, "divisions")) divisions = Number(textOf(attrs, "divisions")) || divisions;
        const key = child(attrs, "key"); if (key) { fifths = Number(textOf(key, "fifths")) || 0; mode = textOf(key, "mode") || mode; }
        const time = child(attrs, "time"); if (time) beats = Number(textOf(time, "beats")) || beats;
        const sign = textOf(child(attrs, "clef"), "sign"); if (sign) clef = sign === "percussion" ? "percussion" : sign;
      }
      for (const d of kids(measure, "direction")) { const t = Number(child(d, "sound")?.attrs.tempo || textOf(child(child(d, "direction-type"), "metronome"), "per-minute")); if (t) bpm = t; }
      const barStart = stepCursor;
      let at = barStart, lastStart = barStart;
      for (const el of measure.children) {
        if (el.name === "backup") { at -= toSteps(textOf(el, "duration"), divisions); continue; }
        if (el.name === "forward") { at += toSteps(textOf(el, "duration"), divisions); continue; }
        if (el.name !== "note") continue;
        const steps = toSteps(textOf(el, "duration"), divisions);
        const isChord = Boolean(child(el, "chord"));
        const start = isChord ? lastStart : at;
        if (!isChord) { lastStart = at; at += steps; }
        if (child(el, "rest") || child(el, "grace")) continue;
        const role = roleFromClef();
        let midi, patch = null;
        if (child(el, "pitch")) {
          const p = child(el, "pitch");
          midi = 12 * (Number(textOf(p, "octave")) + 1) + STEP_PC[textOf(p, "step")] + (Number(textOf(p, "alter")) || 0);
        } else if (child(el, "unpitched")) {
          const u = child(el, "unpitched");
          patch = DRUM_FROM_LINE[`${textOf(u, "display-step")}${textOf(u, "display-octave")}`] || "snare";
          midi = DRUM_MIDI[patch];
        } else continue;
        const id = el.attrs.id || `sheet-${++counter}`;
        const own = ownIds.has(id) || /^#?ff2bd6$/i.test(el.attrs.color || "");
        notes.push({ id, step: start, duration_steps: Math.max(1, steps), velocity: .8, role, patch_id: patch || (role === "bass" ? "clean_bass" : role === "harmony" ? "warm_keys" : "warm_keys"),
          pitch_lock_mode: "concrete", concrete: role === "drums" ? { midi, freq_hz: 200 } : { midi_pitch: midi, freq_hz: 440 * 2 ** ((midi - 69) / 12) },
          provenance: own ? "user_placed" : "generator_default" });
      }
      stepCursor = barStart + beats * 4;
      totalSteps = Math.max(totalSteps, stepCursor);
    }
  }
  const major = ((fifths % 12) + 12) % 12, rootMajor = Object.entries(MAJOR_FIFTHS).find(([, f]) => f === fifths)?.[0];
  const root_pc = rootMajor === undefined ? 0 : mode === "minor" ? (Number(rootMajor) + 9) % 12 : Number(rootMajor);
  return { ok: true, title: textOf(child(score, "work"), "work-title") || "Opened sheet", bpm, root_pc, scale_type: mode === "minor" ? "minor" : "major",
    steps_per_bar: beats * 4, bars: Math.max(1, Math.round(totalSteps / (beats * 4))), notes };
}
const toSteps = (duration, divisions) => Math.max(0, Math.round((Number(duration) || 0) / divisions * DIVISIONS));

/* ---- drawing ---- */
const STAFF_GAP = 8, LINE = 1, PART_H = 74, BAR_W = 196, LEFT = 44, TOP = 28, PER_LINE = 4;
// Diatonic position of a pitch on the staff: 0 = bottom line of the treble staff (E4).
const diatonic = (step, octave) => "CDEFGAB".indexOf(step) + 7 * octave;

/** Events that actually sounded, as absolute steps, so a sheet can write itself while music plays. */
export function eventsFromTake(take, { until = Infinity } = {}) {
  if (!take?.events?.length) return { events: [], step: 0 };
  const stepSec = 15 / (take.bpm || 100);
  const events = take.events.filter(r => r && r.event && r.time <= until && (r.event.velocity ?? 1) > 0).map(r => ({
    ...r.event, step: Math.max(0, Math.round((r.time - take.start) / stepSec)),
    duration_steps: Math.max(1, Math.round((Number(r.duration) || stepSec) / stepSec)) }));
  return { events, step: Math.max(0, (Math.min(until, Number.MAX_SAFE_INTEGER) - take.start) / stepSec) };
}

export function renderSheetSvg(score, { playheadStep = null, width = null, beat = true } = {}) {
  const parts = score.parts.map(id => SHEET_PARTS.find(p => p.id === id));
  const systems = Math.ceil(score.measures.length / PER_LINE);
  const systemH = parts.length * PART_H + 16;
  const w = width || LEFT + PER_LINE * BAR_W + 16, h = TOP + systems * systemH;
  const out = [`<svg class="pf-sheet" xmlns="${"http:"}//www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${xml(score.title)} as sheet music">`];
  out.push(`<text x="${LEFT}" y="18" class="pf-sheet-title">${xml(score.title)}</text>`);
  out.push(`<text x="${w - 16}" y="18" text-anchor="end" class="pf-sheet-tempo">♩ = ${Math.round(score.bpm)}</text>`);
  score.measures.forEach((m, mi) => {
    const sys = Math.floor(mi / PER_LINE), col = mi % PER_LINE;
    const x0 = LEFT + col * BAR_W, y0 = TOP + sys * systemH;
    parts.forEach((p, pi) => {
      const top = y0 + pi * PART_H + 12;
      const lineY = i => top + i * STAFF_GAP;              // i = 0 top line .. 4 bottom line
      if (col === 0) {
        for (let i = 0; i < 5; i++) out.push(`<line x1="${LEFT - 30}" x2="${LEFT + PER_LINE * BAR_W}" y1="${lineY(i)}" y2="${lineY(i)}" class="pf-sheet-line"/>`);
        out.push(`<text x="${LEFT - 42}" y="${lineY(2) + 4}" class="pf-sheet-part pf-part-${p.id}">${p.id === "tune" ? "♪" : p.id === "bass" ? "𝄢" : p.id === "drums" ? "𝄥" : "𝄞"}</text>`);
        out.push(`<title>${xml(p.label)}</title>`);
      }
      out.push(`<line x1="${x0}" x2="${x0}" y1="${lineY(0)}" y2="${lineY(4)}" class="pf-sheet-bar"/>`);
      const stepX = s => x0 + 10 + (s / score.stepsPerBar) * (BAR_W - 14);
      // where a pitch sits: treble bottom line E4 = pos 0; bass bottom line G2
      const base = p.clef === "F" ? diatonic("G", 2) : diatonic("E", 4);
      const yFor = midi => {
        if (p.clef === "percussion") { return lineY(4) - 0; }
        const { step, octave } = spellPitch(midi, score.key.flats);
        const pos = diatonic(step, octave) - base;        // 0 bottom line, 8 top line
        return lineY(4) - pos * (STAFF_GAP / 2);
      };
      for (const item of m.parts[p.id]) {
        const x = stepX(item.step);
        const sounding = playheadStep !== null && playheadStep >= mi * score.stepsPerBar + item.step && playheadStep < mi * score.stepsPerBar + item.step + item.steps;
        if (item.kind === "rest") {
          out.push(`<rect x="${x - 3}" y="${lineY(item.type === "whole" ? 1 : 2) - (item.type === "half" ? 4 : 0)}" width="7" height="4" class="pf-sheet-rest" data-type="${item.type}"/>`);
          continue;
        }
        const heads = item.notes.map(n => {
          const [ds, doct, headKind] = p.clef === "percussion" ? (DRUM_LINES[n.patch] || DRUM_LINES.snare) : [];
          const y = p.clef === "percussion" ? lineY(4) - (diatonic(ds, doct) - diatonic("E", 4)) * (STAFF_GAP / 2) : yFor(n.midi);
          const ledger = [];
          if (p.clef !== "percussion") {
            for (let ly = lineY(4) + STAFF_GAP; ly <= y + 1; ly += STAFF_GAP) ledger.push(ly);
            for (let ly = lineY(0) - STAFF_GAP; ly >= y - 1; ly -= STAFF_GAP) ledger.push(ly);
          }
          const acc = p.clef === "percussion" ? 0 : spellPitch(n.midi, score.key.flats).alter;
          return { y, n, headKind: headKind || "normal", ledger, acc };
        });
        const ys = heads.map(h => h.y), stemUp = Math.max(...ys) > lineY(2);
        const open = item.type === "whole" || item.type === "half";
        for (const h of heads) {
          for (const ly of h.ledger) out.push(`<line x1="${x - 7}" x2="${x + 7}" y1="${ly}" y2="${ly}" class="pf-sheet-line"/>`);
          if (h.acc) out.push(`<text x="${x - 11}" y="${h.y + 4}" class="pf-sheet-acc">${h.acc > 0 ? "♯" : "♭"}</text>`);
          const cls = `pf-sheet-note pf-part-${p.id}${h.n.own ? " own" : ""}${sounding ? " now" : ""}`;
          const attrs = `class="${cls}" data-id="${xml(h.n.id)}" data-step="${mi * score.stepsPerBar + item.step}"`;
          if (h.headKind === "x" || h.headKind === "circle-x") out.push(`<path d="M${x - 4} ${h.y - 4}L${x + 4} ${h.y + 4}M${x - 4} ${h.y + 4}L${x + 4} ${h.y - 4}" ${attrs} fill="none"/>`);
          else out.push(`<ellipse cx="${x}" cy="${h.y}" rx="4.6" ry="3.4" ${attrs}${open ? ' data-open="1"' : ""} transform="rotate(-20 ${x} ${h.y})"/>`);
        }
        if (item.type !== "whole") {
          const y1 = stemUp ? Math.max(...ys) : Math.min(...ys), y2 = stemUp ? Math.min(...ys) - 24 : Math.max(...ys) + 24;
          const sx = stemUp ? x + 4 : x - 4;
          out.push(`<line x1="${sx}" x2="${sx}" y1="${y1}" y2="${y2}" class="pf-sheet-stem pf-part-${p.id}"/>`);
          const flags = item.type === "eighth" ? 1 : item.type === "16th" ? 2 : 0;
          for (let f = 0; f < flags; f++) {
            const fy = y2 + (stemUp ? f * 6 : -f * 6);
            out.push(`<path d="M${sx} ${fy} q 8 ${stemUp ? 4 : -4} 6 ${stemUp ? 14 : -14}" class="pf-sheet-flag pf-part-${p.id}" fill="none"/>`);
          }
        }
        for (let d = 0; d < item.dots; d++) out.push(`<circle cx="${x + 9 + d * 4}" cy="${ys[0] - 3}" r="1.4" class="pf-sheet-dot"/>`);
      }
    });
    if (playheadStep !== null && playheadStep >= mi * score.stepsPerBar && playheadStep < (mi + 1) * score.stepsPerBar) {
      const local = playheadStep - mi * score.stepsPerBar;
      const px = x0 + 10 + (local / score.stepsPerBar) * (BAR_W - 14);
      out.push(`<line x1="${px}" x2="${px}" y1="${y0}" y2="${y0 + parts.length * PART_H}" class="pf-sheet-playhead"/>`);
      if (beat) {
        // The beat as a bouncing ball: it lands on each beat and is highest halfway to the next.
        const beatIndex = Math.floor(local / 4), frac = (local / 4) - beatIndex;
        const bx = x0 + 10 + ((beatIndex * 4) / score.stepsPerBar) * (BAR_W - 14) + frac * (4 / score.stepsPerBar) * (BAR_W - 14);
        const lift = 4 * frac * (1 - frac) * 14;
        out.push(`<circle cx="${bx.toFixed(1)}" cy="${(y0 + 4 - lift).toFixed(1)}" r="4" class="pf-sheet-beat" data-beat="${beatIndex + 1}"/>`);
        for (let b = 0; b < score.stepsPerBar / 4; b++) {
          const lx = x0 + 10 + ((b * 4) / score.stepsPerBar) * (BAR_W - 14);
          out.push(`<circle cx="${lx}" cy="${y0 + 6}" r="1.6" class="pf-sheet-beat-mark${b === beatIndex ? " on" : ""}"/>`);
        }
      }
    }
  });
  out.push("</svg>");
  return out.join("");
}
