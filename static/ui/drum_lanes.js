import { getInstrument } from '../js/theory/instrument_catalogue.js';
import { isSampledPatch } from '../js/audio/sampled_piano.js';

// Match the compiler's effective kit, including old notes without performance metadata.
export function drumKit(note, doc) {
  const p = note?.performance;
  return p && typeof p === 'object' && !Array.isArray(p) && p.version === 1
    && ['soft', 'punchy', 'tiny'].includes(note.drum_kit)
    ? note.drum_kit : doc.drum_kit || 'punchy';
}

export function drumLaneKey(note, doc) {
  // Legacy sampled instruments can occur in the drum role and still sound pitched.
  return JSON.stringify([note.patch_id || 'kick', drumKit(note, doc),
    isSampledPatch(note.patch_id) ? Number(note.concrete?.midi_pitch || 36) : null]);
}

export function drumLanes(doc) {
  const notes = doc.notes.filter(n => n.role === 'drums');
  const sources = notes.length ? notes : [{role: 'drums', patch_id: 'kick', concrete: {midi_pitch: 36}}];
  const lanes = new Map();
  for (const note of sources) {
    const key = drumLaneKey(note, doc);
    if (lanes.has(key)) continue;
    const patch = note.patch_id || 'kick';
    const name = getInstrument(patch)?.label || `Sound: ${patch.replaceAll('_', ' ')}`;
    const kit = drumKit(note, doc);
    lanes.set(key, {key, patch, kit, source: note,
      label: `${name}${isSampledPatch(patch) ? `, note ${Number(note.concrete?.midi_pitch || 36)}` : ''}`});
  }
  const result = [...lanes.values()];
  const labels = result.map(lane => lane.label);
  for (const lane of result) {
    if (labels.filter(label => label === lane.label).length > 1) lane.label += ` (${lane.kit})`;
  }
  return result;
}

export function drumLaneTop(note, doc, lanes) {
  return 12 + Math.max(0, lanes.findIndex(lane => lane.key === drumLaneKey(note, doc))) * 56;
}
