/**
 * Selected Note White-Box Inspector (Relational vs. Concrete Pitch Lock & Gesture Summary)
 */

export function renderNoteInspector(containerEl, rawNote, compiledEvent, { onTogglePitchLock, onDeleteNote }) {
  if (!rawNote && !compiledEvent) {
    containerEl.innerHTML = `
      <div>Click any active step in the <strong>Bass &amp; Synth Matrix</strong> or <strong>Melody Canvas</strong> to inspect its note and sound settings.</div>
    `;
    return;
  }

  const note = compiledEvent || rawNote;
  const concrete = note.concrete || {};
  const rel = note.relational || {};
  const g = note.gesture || {};
  const lockMode = note.pitch_lock_mode || "relational";
  const gritDesc = Number(g.grit ?? 0.8) >= 0.7 ? "Strong" : Number(g.grit ?? 0.8) >= 0.35 ? "Warm" : "Gentle";

  containerEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong>Step ${(note.step ?? 0) + 1} &bull; ${note.patch_id || note.role}</strong>
      <span class="mono-readout">${concrete.note_name || "G1"} (${Number(concrete.freq_hz || 55).toFixed(1)} Hz)</span>
    </div>
    <div>
      <span>Pitch Mode: <strong>${lockMode.toUpperCase()}</strong></span>
      ${
        lockMode === "relational"
          ? `<span> (Chord Tone #${(rel.chord_tone_index ?? 0) + 1}, Offset ${rel.scale_degree_offset ?? 0})</span>`
          : `<span> (Pinned to MIDI ${concrete.midi_pitch ?? 60})</span>`
      }
    </div>
    <div style="color:#38bdf8; font-size:11px;">
      ${note.why_label || "Follows active bar's chord gravity automatically."}
    </div>
    <div style="font-size:11px; color:#94a3b8;">
      Sound: Tone <strong>${g.vowel_start || "O"}&rarr;${g.vowel_end || "I"}</strong> |
      Drive <strong>${gritDesc}</strong> |
      Pulse <strong>${g.lfo_rate || "off"}</strong> |
      Chop <strong>${g.stutter_div || "off"}</strong>
    </div>
    <div style="display:flex; gap:6px; margin-top:4px;">
      <button id="btn-inspector-lock" class="btn btn-sm btn-secondary">
        ${lockMode === "relational" ? "Pin to Concrete MIDI Pitch" : "Switch to Relational Gravity"}
      </button>
      <button id="btn-inspector-delete" class="btn btn-sm btn-ghost" style="color:#fb7185;">
        Delete Note
      </button>
    </div>
  `;

  const lockBtn = containerEl.querySelector("#btn-inspector-lock");
  if (lockBtn && rawNote) {
    lockBtn.addEventListener("click", () => onTogglePitchLock(rawNote));
  }
  const delBtn = containerEl.querySelector("#btn-inspector-delete");
  if (delBtn && rawNote) {
    delBtn.addEventListener("click", () => onDeleteNote(rawNote));
  }
}
