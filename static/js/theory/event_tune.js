/** Exact-note editing for performances that cannot fit one note per grid cell. */
export function hasLeadCollisions(notes, bars = 4) {
  const steps = new Set();
  for (const note of notes || []) {
    if (note.role !== 'lead' || note.step < 0 || note.step >= bars * 16) continue;
    if (steps.has(note.step)) return true;
    steps.add(note.step);
  }
  return false;
}

export function editLeadEvent(notes, id, action, { totalSteps = 64, role = 'lead' } = {}) {
  const matches = notes.filter(n => n.role === role && n.id === id);
  if (matches.length !== 1) throw new Error('Choose one note first.');
  return notes.flatMap(note => {
    if (note !== matches[0]) return [note];
    if (action === 'remove') return [];
    const next = JSON.parse(JSON.stringify(note));
    if (action === 'up' || action === 'down') {
      const midi = Number(next.concrete?.midi_pitch ?? next.concrete?.midi);
      if (!Number.isFinite(midi)) throw new Error('This note needs a pitch.');
      const pitch = Math.max(0, Math.min(127, midi + (action === 'up' ? 1 : -1)));
      next.concrete = { ...next.concrete, midi_pitch: pitch };
      if ('midi' in next.concrete) next.concrete.midi = pitch;
      if ('freq_hz' in next.concrete) next.concrete.freq_hz = 440 * 2 ** ((pitch - 69) / 12);
      next.pitch_lock_mode = 'concrete';
    } else if (action === 'longer' || action === 'shorter') {
      next.duration_steps = Math.max(.05, Math.min(64, Number(next.duration_steps || 1) + (action === 'longer' ? .25 : -.25)));
    } else if (action === 'earlier' || action === 'later') {
      const position = Number(next.step) + (next.performance?.version === 1 ? Number(next.performance.offset_steps || 0) : 0);
      const moved = Math.max(0, Math.min(totalSteps - .05, position + (action === 'later' ? .25 : -.25)));
      next.step = Math.floor(moved);
      next.performance = { ...next.performance, version: 1, offset_steps: moved - next.step };
    } else throw new Error('Unknown note edit.');
    // A deliberate edit must not be replaced on return to the band. Keep the
    // origin label, but retire the generator's permission to replace this note.
    if (next.generated_by) {
      next.edited_from_generator = next.generated_by;
      delete next.generated_by;
    }
    return [next];
  });
}
