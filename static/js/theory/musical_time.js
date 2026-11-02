/** Sixteenth-note clock; BPM always counts quarter notes. Old songs default to 4/4. */
export function stepsPerBar(doc) {
  const value=doc?.global_context?.steps_per_bar ?? doc?.steps_per_bar ?? 16;
  if(value!==12 && value!==16)throw new Error('Unsupported musical cycle.');
  return value;
}
