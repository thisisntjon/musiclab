/**
 * Existing synthesized voices are supported by both renderers. The optional
 * sampled_*_v1 choices use the browser sampler; Python explicitly refuses substitution.
 * Kits select timbre; individual drum entries select a voice within that kit.
 * reverse_swell is also an arranger effect, but is a playable pitched voice.
 */
export const INSTRUMENT_GROUPS = Object.freeze([
  { id: "keys", label: "Keys and synths" },
  { id: "winds", label: "Wind instruments" },
  { id: "strings", label: "Strings" },
  { id: "bass", label: "Bass sounds" },
  { id: "drums", label: "Drums and taps" },
  { id: "effects", label: "Sound effects" },
].map(Object.freeze));

const pitched = (id, label, group, description, previewMidi = 60, image = "synth") => ({
  id, label, group, kind: "pitched", patchId: id, role: "lead", icon: image === "keys" ? "keys" : "synth",
  image: new URL(`../../assets/instruments/${image}.svg`, import.meta.url).href, previewMidi, previewDuration: .6, description,
});
const drum = (id, label, patchId, image, description, kitId = "punchy") => ({
  id, label, group: "drums", kind: "drums", patchId, kitId, role: "drums", icon: "drum",
  image: new URL(`../../assets/instruments/${image}.svg`, import.meta.url).href, previewMidi: 36, previewDuration: .3, description,
});

export const INSTRUMENTS = Object.freeze([
  pitched("sampled_organ_v1", "Tonewheel organ", "keys", "Organ samples from the bundled Tonewheel Organ preset. Separate held notes; no rotary-speaker controls.", 60, "organ"),
  pitched("sampled_harmonica_v1", "Harmonica", "winds", "Harmonica notes from the bundled sample bank. Straight notes without breath bends.", 76, "harmonica"),
  pitched("sampled_strings_v1", "String ensemble", "strings", "Bundled Fast Strings ensemble samples, with a ringing release after the key lifts.", 60, "strings"),
  pitched("sampled_trumpet_v1", "Trumpet", "winds", "Trumpet notes from the bundled sample bank.", 67, "trumpet"),
  pitched("sampled_tenor_sax_v1", "Tenor sax", "winds", "Rounded tenor sax samples with a gentle attack.", 60, "sax"),
  pitched("sampled_clarinet_v1", "Clarinet", "winds", "Clarinet notes from the bundled sample bank.", 67, "clarinet"),
  pitched("sampled_piano_v1", "Sampled piano", "keys", "Acoustic piano samples. Loads on your computer before you play.", 60, "keys"),
  pitched("sampled_electric_piano_v1", "Electric piano", "keys", "Rounded, ringing electric piano samples.", 60, "keys"),
  pitched("sampled_steel_guitar_v1", "Steel-string guitar", "strings", "Acoustic steel-string guitar from the bundled sample bank.", 60, "guitar"),
  pitched("sampled_guitar_v1", "Nylon guitar", "strings", "Warm nylon-string guitar samples.", 60, "guitar"),
  pitched("sampled_overdrive_guitar_v1", "Overdrive guitar", "strings", "Overdriven guitar samples from the bundled bank. No amplifier or palm-mute controls.", 60, "guitar"),
  pitched("sampled_clean_guitar_v1", "Clean guitar", "strings", "Clean electric-guitar notes from the bundled sample bank.", 60, "guitar"),
  pitched("sampled_banjo_v1", "Banjo", "strings", "Bright plucked notes from the bundled Banjo sample preset.", 67, "banjo"),
  pitched("sampled_bass_v1", "Finger bass", "bass", "Low notes from sampled finger-played electric bass.", 40, "bass-guitar"),
  pitched("sampled_ooh_v1", "Ooh vowels", "keys", "Sampled vowel sounds from the bundled keyboard bank. No words or lyrics.", 60, "keys"),
  pitched("warm_keys", "Soft keys", "keys", "Soft notes from a synth keyboard.", 60, "keys"),
  pitched("pluck_lead", "Plucked synth", "keys", "A short, bright pluck made by a synth."),
  pitched("supersaw_stab", "Bright synth", "keys", "A wide, bright synth sound."),
  pitched("clean_bass", "Smooth bass", "bass", "A smooth low synth tone.", 36, "bass-synth"),
  pitched("wobble_bass", "Wobble bass", "bass", "A low synth that pulses.", 36, "bass-synth"),
  pitched("sub_drop_808", "Falling bass", "bass", "A deep synth note that drops in pitch.", 36, "bass-synth"),
  pitched("monster_growl", "Growl synth", "bass", "A rough synth with a deep growl.", 43, "bass-synth"),
  pitched("talking_yoi", "Talking synth", "bass", "A synth that bends like a voice. No recorded voice.", 43, "bass-synth"),
  drum("soft", "Soft drums", "kick", "drum-kit", "A soft kit made with synth sounds.", "soft"),
  drum("punchy", "Punchy drums", "clap", "drum-kit", "A strong kit made with synth sounds.", "punchy"),
  drum("tiny", "Tiny drums", "hat_closed", "drum-kit", "A small, bright synth kit.", "tiny"),
  drum("kick", "Kick drum", "kick", "kick", "A low synth drum thump."),
  drum("snare", "Snare drum", "snare", "snare", "A synth drum with a sharp noise tail."),
  drum("clap", "Hand clap", "clap", "clap", "A clap made from short noise bursts."),
  drum("hat_closed", "Closed hi-hat", "hat_closed", "hats", "A short, bright synth tick."),
  drum("hat_open", "Open hi-hat", "hat_open", "hats", "A longer, bright synth hiss."),
  drum("perc", "Noise tick", "perc", "noise", "A bright noise tap."),
  pitched("laser_screech", "Laser synth", "effects", "A sharp synth sweep."),
  pitched("vocal_chop", "Chopped synth", "effects", "A gated synth with a voice-like tone. No recorded voice."),
  pitched("reverse_swell", "Rising swell", "effects", "A synth sound that grows into the note."),
].map(Object.freeze));

export function getInstrument(id) {
  return INSTRUMENTS.find(instrument => instrument.id === id) || null;
}

export function instrumentsInGroup(group) {
  return INSTRUMENTS.filter(instrument => instrument.group === group);
}

/** Bounded pages prevent an opening wall of cards; no choice is locked away. */
export function instrumentPage(group, page = 0, size = 3) {
  const all = instrumentsInGroup(group);
  const pageSize = Number.isInteger(size) && size > 0 ? Math.min(size, 6) : 3;
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const index = Math.max(0, Math.min(pages - 1, Number.isInteger(page) ? page : 0));
  return { items: all.slice(index * pageSize, (index + 1) * pageSize), page: index, pages, total: all.length };
}
