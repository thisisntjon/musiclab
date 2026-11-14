/**
 * Storage that never stops MusicLab from starting (open-release audit S16).
 *
 * When a browser blocks site data (Chrome's "Don't allow sites to save data", a school policy, Safari's Block All
 * Cookies), even reading `window.localStorage` throws. Then songs, settings and drafts live in memory for this visit
 * only, every reader gets that same memory store, and the screen says to use Download to keep songs.
 *
 * `safeStorage(name, host)` returns the real storage when it can be read, or the memory store for that host.
 * `installSafeStorage(host)` puts the memory store in place of a blocked `localStorage` and `sessionStorage`, so all
 * existing code that reads them keeps working. It returns true when storage was blocked.
 */
export function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(String(key)); },
    clear: () => { values.clear(); },
  };
}

const fallbacks = new WeakMap();
function fallbackFor(host, name) {
  if (!fallbacks.has(host)) fallbacks.set(host, {});
  const stores = fallbacks.get(host);
  return stores[name] ||= memoryStorage();
}

function readable(host, name) {
  try {
    const storage = host[name];
    if (!storage || typeof storage.getItem !== 'function') return null;
    storage.getItem('musiclab.storage-check');
    return storage;
  } catch (_) {
    return null;
  }
}

const defaultHost = () => globalThis.window ?? globalThis;

export function safeStorage(name = 'localStorage', host = defaultHost()) {
  return readable(host, name) || fallbackFor(host, name);
}

export function installSafeStorage(host = defaultHost()) {
  let blocked = false;
  for (const name of ['localStorage', 'sessionStorage']) {
    if (readable(host, name)) continue;
    if (name === 'localStorage') blocked = true;
    const store = fallbackFor(host, name);
    try {
      Object.defineProperty(host, name, { configurable: true, enumerable: true, get: () => store });
    } catch (_) { /* a host that refuses: callers that use safeStorage() still work */ }
  }
  return blocked;
}
