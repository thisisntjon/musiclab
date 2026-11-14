// Cloudflare Worker for the standalone MusicLab static origin (https://musiclab.simoneresearch.com/).
//
// Static assets answer almost every request without this Worker: the entry pages, their aliases (public/_redirects)
// and every header (public/_headers). wrangler.json runs the Worker first only for the paths that need code:
// - /favicon.ico: a small SVG icon (no icon file ships in the package).
// - /api/*: the local Python server's API does not exist on a static host, so it answers JSON 404 "static_mode".
// Requests that match no asset may also reach this Worker; it hands them back to the assets, which answer 404.html.
//
// The unmodified GeneralUser GS 2.0.3 source bank (32,319,396 bytes) stays in the release package and the source
// repository for reproducibility. The hosted site does not serve it: the app loads only the pinned subset bank.

export const SF2_PATH = '/static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2';
export const SF2_TOTAL_BYTES = 32319396;
export const SF2_SHA256 = '9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe';

export const CSP_HEADER = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' is required by SpessaSynth's embedded stb-vorbis WebAssembly decoder
  // (engine.js and spessasynth_processor.min.js). The two pinned SHA-256 hashes allow ONLY
  // static/index.html's #boot-check script and its onerror="musicLabBootFailed()" handler,
  // avoiding script-src 'unsafe-inline'.
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-hashes' __MUSICLAB_SCRIPT_HASHES__",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export function securityHeaders(extra = {}) {
  const headers = new Headers({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    // Keep microphone=(self) enabled for MusicLab's opt-in "Hum an idea" recorder.
    'Permissions-Policy':
      'geolocation=(), microphone=(self), camera=(), payment=(), usb=(), interest-cohort=()',
    // Another site cannot keep a handle to a MusicLab window it opened, or embed MusicLab's files.
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': CSP_HEADER,
    ...extra,
  });
  return headers;
}

export const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2563eb"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>';

function notServed() {
  return new Response('Not Found', {
    status: 404,
    headers: securityHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }),
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/favicon.ico') {
      return new Response(request.method === 'HEAD' ? null : FAVICON_SVG, {
        status: 200,
        headers: securityHeaders({
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        }),
      });
    }
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, error: 'static_mode' }), {
        status: 404,
        headers: securityHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        }),
      });
    }
    // The full source bank, and the shard paths that once served it, are not served from this host.
    if (pathname === SF2_PATH || pathname.startsWith('/_bank_shards/')) return notServed();
    return env.ASSETS.fetch(request);
  },
};
