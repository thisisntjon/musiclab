/** Optional written-tune echo preview; never modifies the source document. */
import {ensureSectionIds, insertSongPart, extractSongMaterial, MAX_SONG_CARDS} from './song_view.js';
import {SCALES} from './harmony.js';
import {stepsPerBar} from './musical_time.js';
const clone = v => structuredClone(v);
const own = n => ['user_placed','hummed_confirmed'].includes(n.provenance);
const keepsHold = (card,n) => card.preserve_performed_holds === true && n.performance?.version === 1
  && Number.isFinite(n.step) && Number.isFinite(n.performance?.offset_steps ?? 0)
  && Number.isFinite(n.duration_steps) && n.duration_steps > 0 && n.duration_steps <= 64;

export function previewEchoAnswer(doc, index, {placement='insert'}={}) {
  const before = clone(doc), after = clone(doc);
  const result = { before, after, index, afterIndex: index, changed: false, kind: 'answer' };
  const decline = reason => ({ ...result, reason });
  const cards = ensureSectionIds(doc.song_cards);
  if (!Number.isInteger(index) || !cards[index]) return decline('Choose a part.');
  if (placement !== 'replace' && cards.length >= MAX_SONG_CARDS) return decline('This song has eight parts. Remove a part to add an echo.');
  const rawNotes = doc.song_cards[index]?.material?.notes || doc.notes || [];
  if(rawNotes.some(n=>!Number.isFinite(n.step)||!Number.isFinite(n.duration_steps)||!Number.isFinite(n.performance?.offset_steps ?? 0)))
    return decline('A note needs a different edit. Your tune stays.');
  const source = cards[index], material = extractSongMaterial(source.material || doc);
  const spb = stepsPerBar(doc);
  const end = source.bars * spb;
  // Echo the written tune without part effects; originals and their effects stay intact.
  if (!source.tune) return decline('Turn on the tune in this part to try an echo.');
  const available = (material.notes || []).filter(n => n.role === 'lead' && n.step >= 0 && n.step < end);
  const personal = available.filter(own), lead = personal.length ? personal : available;
  if (!lead.length) return decline('This part has no tune to echo.');
  if (lead.some(n => !Number.isFinite(n.duration_steps) || n.duration_steps <= 0 || (n.step + (n.performance?.offset_steps || 0) + n.duration_steps > end && !keepsHold(source,n)))) {
    return decline('A held note goes past this part. It needs more room for an echo.');
  }
  // Current compiler uses following-card settings for pre-drop breath and continuous holds.
  const last = cards.at(-1), previous = cards.at(-2);
  if (placement !== 'replace' && (last.big || (previous?.capture_segment && last.capture_segment
    && previous.capture_segment.take_id === last.capture_segment.take_id
    && previous.capture_segment.end_step === last.capture_segment.start_step))) {
    return decline('This echo would break a held note or a big finish. Try a different song shape.');
  }
  const inserted = placement === 'replace' ? {cards:clone(cards),selectedSectionId:source.section_id} : insertSongPart(cards, source.section_id, extractSongMaterial(doc));
  const afterIndex = inserted.cards.findIndex(c => c.section_id === inserted.selectedSectionId);
  const added = inserted.cards[afterIndex];
  const answerNotes = lead.map((note, i) => {
    const copied = { ...clone(note), id: `echo-${added.section_id}-${i+1}`, source_note_id: note.id,
      provenance: 'jam_generated', generated_by: 'musiclab_melody_answer' };
    delete copied.capture_occurrence;
    delete copied.edited_from_generator;
    return copied;
  });
  inserted.cards[afterIndex] = { ...clone(source), section_id: added.section_id, role_name: 'Echo answer',
    tune: true, big: false, fx: null, tune_variant: null,
    material: { ...material, notes: [...(material.notes || []).filter(n => n.role !== 'lead'), ...answerNotes] } };
  if (placement !== 'replace') delete inserted.cards[afterIndex].capture_segment;
  // Grid cache contains old source identities and must be regenerated from the new editable notes.
  delete inserted.cards[afterIndex].material.tune_grid_state;
  after.song_cards = inserted.cards;
  return { ...result, after, afterIndex, changed: true };
}

/** A named, bounded alternative: only the final written pitch moves up one scale step.
 * The full source part remains in the song, including after save/reopen.
 */
export function previewEndingIdea(doc, index, {placement='insert'}={}) {
  const base = previewEchoAnswer(doc, index, {placement});
  const result = {...base, kind: 'ending'};
  const decline = reason => ({...result, after: clone(base.before), changed: false, reason});
  if (!base.changed) return result;
  if (!doc.song_cards?.[index]) return decline('Choose a part.');
  const raw = doc.song_cards[index].material || doc;
  if ((raw.notes || []).some(n => !Number.isFinite(n.step) || !Number.isFinite(n.duration_steps)
    || !Number.isFinite(n.performance?.offset_steps ?? 0))) return decline('A note needs a different edit. Your tune stays.');
  const source = ensureSectionIds(doc.song_cards)[index];
  const material = extractSongMaterial(source.material || doc);
  const end = source.bars * stepsPerBar(doc);
  if ((source.big && placement !== 'replace') || source.fx || source.tune_variant) return decline('Turn off part effects to try this ending.');
  // Removing capture continuity must never shorten a held note, in any role.
  if ((material.notes || []).some(n => !Number.isFinite(n.step) || !Number.isFinite(n.duration_steps)
    || n.duration_steps <= 0 || !Number.isFinite(n.performance?.offset_steps ?? 0)
    || n.step + (n.performance?.offset_steps ?? 0) < 0
    || (n.step + (n.performance?.offset_steps ?? 0) < end
      && n.step + (n.performance?.offset_steps ?? 0) + n.duration_steps > end && !keepsHold(source,n))))
    return decline('A note needs more room. Your tune stays as it is.');
  // Relational harmony can revoice itself when melody changes; do not promise a one-note edit then.
  if ((material.notes || []).some(n => ['lead','harmony','chord','chords','bass','hocket'].includes(n.role) && (n.pitch_lock_mode !== 'concrete' || !Number.isFinite(n.concrete?.midi_pitch))))
    return decline('This band follows the tune. Try editing one note instead.');
  const effective = {...doc, ...material};
  if ((source.under && effective.auto_harmony_stabs !== false && !(material.notes || []).some(n => n.role === 'harmony'))
    || effective.stereo_jux || effective.harmony_style === 'wide_echo' || effective.underneath?.harmony_style === 'wide_echo')
    return decline('This band follows the tune. Try editing one note instead.');
  const lead = (material.notes || []).filter(n => n.role === 'lead' && n.step + (n.performance?.offset_steps ?? 0) < end);
  const last = lead.reduce((a,n) => !a || n.step + (n.performance?.offset_steps ?? 0) >= a.step + (a.performance?.offset_steps ?? 0) ? n : a, null);
  if (last && lead.filter(n => n.step + (n.performance?.offset_steps ?? 0) === last.step + (last.performance?.offset_steps ?? 0)).length > 1)
    return decline('Two notes end here. Pick one to edit.');
  const pitch = last?.concrete?.midi_pitch;
  const context = doc.global_context || {}, scale = SCALES[context.scale_type || 'major'];
  if (!Number.isInteger(pitch) || pitch < 0 || pitch >= 127 || !scale || !Number.isInteger(context.root_pc ?? 0))
    return decline('This note needs a different kind of edit. Your tune stays.');
  const root = ((context.root_pc ?? 0) % 12 + 12) % 12;
  let next = pitch + 1;
  while (next <= 127 && !scale.includes((next - root + 120) % 12)) next++;
  if (next > 127) return decline('This note is already high. Your tune stays.');
  const added = base.after.song_cards[base.afterIndex];
  const usedIds = new Set(material.notes.map(n => n.id));
  let generatedId = `ending-${added.section_id}`;
  for (let suffix = 2; usedIds.has(generatedId); suffix++) generatedId = `ending-${added.section_id}-${suffix}`;
  const notes = material.notes.map(n => n === last ? {...clone(n),
    id: generatedId, source_note_id: n.id, provenance: 'jam_generated',
    generated_by: 'musiclab_ending_idea', pitch_lock_mode: 'concrete',
    concrete: {...n.concrete, midi_pitch: next, freq_hz: 440 * 2 ** ((next - 69) / 12)}} : clone(n));
  const changed = notes.find(n => n.generated_by === 'musiclab_ending_idea' && n.id === generatedId);
  delete changed.capture_occurrence;
  delete changed.edited_from_generator;
  const copy = {...clone(source), section_id: added.section_id, role_name: placement === 'replace' ? source.role_name : 'New ending', material: {...material, notes}};
  if (placement !== 'replace') delete copy.capture_segment;
  delete copy.material.tune_grid_state;
  base.after.song_cards[base.afterIndex] = copy;
  return {...result, fromPitch: pitch, toPitch: next, sourceNoteId: last.id};
}
