/**
 * Drawn icons for the play flow (9c-9 + Phase 12b). They replace emoji, which look different on every device and are read
 * aloud by screen readers. Every icon is decoration: the button's own words carry the meaning, so each SVG is
 * aria-hidden. Strokes use currentColor, so contrast and forced-colours rules apply to icons as well.
 */
const PATHS = {
  synth: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="6" cy="9" r="1"/><circle cx="10" cy="9" r="1"/><path d="M14 9h5M2 12h20M6 12v7M10 12v7M14 12v7M18 12v7"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',
  note: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  slow: '<path d="M15 6l-6 6 6 6"/>',
  keys: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v9M12 5v9M16 5v9M3 14h18"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  cards: '<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="6" width="5" height="12" rx="1"/><rect x="16" y="6" width="5" height="12" rx="1"/>',
  fast: '<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  sparkle: '<path d="M12 4l1.8 6.2L20 12l-6.2 1.8L12 20l-1.8-6.2L4 12l6.2-1.8z"/>',
  drum: '<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/>',
  clap: '<circle cx="12" cy="15" r="5"/><path d="M12 3v4M5.5 6.5L8 9M18.5 6.5L16 9"/>',
  feather: '<path d="M20 4C10 4 6 10 6 18M6 18l-2 2M6 18c6 0 11-4 12-10"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  climb: '<path d="M6 18L18 6M9 6h9v9"/>',
  fall: '<path d="M6 6l12 12M18 9v9H9"/>',
  hold: '<path d="M4 12h16M4 8v8M20 8v8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  retry: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
  swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 10.5 3.8 3.8 0 0 0 7 18z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.7-1.5"/>',
  rocket: '<path d="M12 15l-3-3c1.5-5 5-8 11-8 0 6-3 9.5-8 11z"/><path d="M9 12H5l2-4h4M12 15v4l4-2v-4M5 19c0-2 1-3 2-3"/>',
  sliders: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="17" r="2"/>',
  mark_anchor: '<circle cx="12" cy="12" r="5" fill="currentColor"/>',
  mark_step: '<path d="M12 5l7 7-7 7-7-7z"/>',
  mark_edge: '<path d="M12 5l7 13H5z"/>',
};

export const ICON_NAMES = Object.keys(PATHS);

export function icon(name) {
  const body = PATHS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="pf-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
