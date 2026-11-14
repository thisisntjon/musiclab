/**
 * Which host is this page on? A hosted copy is not this computer.
 * - The ?selftest diagnostic runs only on this computer (a file: page or a loopback host), never on a hosted copy.
 * - Calls to /api wait for one GET probe. Only the local MusicLab server (app.py) answers it. A static host answers
 *   404, so nothing else is sent there: no song leaves the device for a host that has no MusicLab server.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True on a file: page or a loopback host. */
export function isLocalPage(location) {
  if (!location) return false;
  if (location.protocol === "file:") return true;
  const host = String(location.hostname || "").toLowerCase();
  return LOOPBACK.has(host) || /^127(?:\.\d{1,3}){3}$/.test(host) || host.endsWith(".localhost");
}

/** The ?selftest diagnostic: asked for, and on this computer. */
export function selftestAllowed(location) {
  return isLocalPage(location) && new URLSearchParams(location.search || "").has("selftest");
}

/** fetch for /api routes that never sends anything to a host without the MusicLab server. */
export function createApiGate(fetchImpl, probePath = "/api/patches") {
  let probe = null;
  const available = () => {
    probe ||= Promise.resolve()
      .then(() => fetchImpl(probePath, { method: "GET", cache: "no-store" }))
      .then((res) => Boolean(res && res.ok), () => false);
    return probe;
  };
  async function apiFetch(path, options) {
    if (!(await available())) throw new Error("Static fallback");
    return fetchImpl(path, options);
  }
  apiFetch.available = available;
  return apiFetch;
}
