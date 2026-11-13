// Cloudflare Worker for standalone MusicLab static origin (https://musiclab.simoneresearch.com/).
//
// Why this Worker exists:
// - static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2 is 32,319,396 bytes (30.82 MiB),
//   exceeding Cloudflare Workers Static Assets' 25 MiB (26,214,400 byte) per-file limit
//   (even gzip-9 is 27.87 MiB and brotli-4 is 27.93 MiB due to PCM sample entropy).
// - MusicLab's privacy and CSP contract requires `connect-src 'self'` and zero offsite requests
//   (static/ui/selftest.js asserts `offsite_requests.length === 0`), while MANIFEST.json and
//   static/js/theory/sampled_sound_capabilities.js pin the exact unmodified SHA-256:
//   9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe.
// - Other release assets are
//   served directly at the edge by Cloudflare Workers Static Assets without invoking this Worker
//   (`run_worker_first` is scoped strictly to the .sf2 path, `/_bank_shards/*`, and `/api/*`).
//
// Supported `.sf2` backends (zero changes to MusicLab's JS or MANIFEST.json):
// 1. Primary (R2 binding `env.SOUND_BANK`): streams key `GeneralUser-GS-2.0.3.sf2` directly
//    from private Cloudflare R2 with native `{ range: { offset, length } }` reads (0 B buffered).
// 2. Zero-R2 fallback (`env.ASSETS` shard streaming): if `env.SOUND_BANK` is not bound, streams
//    two `< 25 MiB` static asset shards (`/_bank_shards/GeneralUser-GS-2.0.3.sf2.part0` 16 MiB +
//    `.part1` 14.82 MiB) sequentially or across arbitrary byte ranges, while blocking direct
//    external requests to `/_bank_shards/*`.

export const SF2_PATH = '/static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2';
export const SF2_R2_KEY = 'GeneralUser-GS-2.0.3.sf2';
export const SF2_TOTAL_BYTES = 32319396;
export const SF2_SHA256 = '9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe';
export const SF2_ETAG = `"sha256-${SF2_SHA256}"`;
export const SHARD_PREFIX = '/_bank_shards/GeneralUser-GS-2.0.3.sf2.part';
export const SHARD_LAYOUT = [
  { path: `${SHARD_PREFIX}0`, start: 0, size: 16777216 },
  { path: `${SHARD_PREFIX}1`, start: 16777216, size: 15542180 },
];

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
    'Content-Security-Policy': CSP_HEADER,
    ...extra,
  });
  return headers;
}

export function parseByteRange(header, total) {
  if (!header || total <= 0) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bytes=')) return null;
  const spec = trimmed.slice(6).trim();
  if (!spec || spec.includes(',')) return null;
  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match || (match[1] === '' && match[2] === '')) return { unsatisfiable: true };
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { unsatisfiable: true };
    const start = Math.max(0, total - suffix);
    return { start, end: total - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? total - 1 : Math.min(total - 1, Number(match[2]));
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= total ||
    start > end
  ) {
    return { unsatisfiable: true };
  }
  return { start, end };
}

function etagMatches(ifNoneMatch) {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((token) => token.trim().replace(/^W\//, ''))
    .some((token) => token === '*' || token === SF2_ETAG);
}

function streamShards(env, origin, start, end) {
  const overlapping = SHARD_LAYOUT.filter(
    (shard) => shard.start <= end && shard.start + shard.size - 1 >= start,
  );
  const { readable, writable } = new TransformStream();
  (async () => {
    const writer = writable.getWriter();
    try {
      for (const shard of overlapping) {
        const res = await env.ASSETS.fetch(new Request(new URL(shard.path, origin)));
        if (!res.ok || !res.body) {
          throw new Error(`Missing SoundFont shard ${shard.path} (${res.status})`);
        }
        const sliceStart = Math.max(0, start - shard.start);
        const sliceEnd = Math.min(shard.size - 1, end - shard.start);
        if (sliceStart === 0 && sliceEnd === shard.size - 1) {
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
        } else {
          // Range reads only buffer the needed shard slice (< 16 MiB).
          const bytes = new Uint8Array(await res.arrayBuffer());
          await writer.write(bytes.subarray(sliceStart, sliceEnd + 1));
        }
      }
      await writer.close();
    } catch (err) {
      await writer.abort(err);
    }
  })();
  return readable;
}

async function serveSoundFont(request, env, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: securityHeaders({ Allow: 'GET, HEAD' }),
    });
  }

  const baseHeaders = securityHeaders({
    'Content-Type': 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    ETag: SF2_ETAG,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-SHA256': SF2_SHA256,
  });

  if (etagMatches(request.headers.get('If-None-Match'))) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const rangeHeader = request.headers.get('Range');
  const parsedRange = parseByteRange(rangeHeader, SF2_TOTAL_BYTES);
  if (parsedRange?.unsatisfiable) {
    baseHeaders.set('Content-Range', `bytes */${SF2_TOTAL_BYTES}`);
    baseHeaders.set('Content-Length', '0');
    return new Response(null, { status: 416, headers: baseHeaders });
  }

  const isPartial = Boolean(parsedRange);
  const start = isPartial ? parsedRange.start : 0;
  const end = isPartial ? parsedRange.end : SF2_TOTAL_BYTES - 1;
  const length = end - start + 1;

  if (isPartial) {
    baseHeaders.set('Content-Range', `bytes ${start}-${end}/${SF2_TOTAL_BYTES}`);
  }
  baseHeaders.set('Content-Length', String(length));

  if (request.method === 'HEAD') {
    return new Response(null, { status: isPartial ? 206 : 200, headers: baseHeaders });
  }

  const edgeCache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`${new URL(request.url).origin}${SF2_PATH}?sha256=${SF2_SHA256}`, {
    method: 'GET',
  });
  if (!isPartial && edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }

  let bodyStream;
  if (env.SOUND_BANK) {
    const r2Obj = await env.SOUND_BANK.get(
      SF2_R2_KEY,
      isPartial ? { range: { offset: start, length } } : undefined,
    );
    if (!r2Obj || !r2Obj.body) {
      return new Response('Sound bank object missing from R2 bucket', {
        status: 503,
        headers: securityHeaders({ 'Cache-Control': 'no-store' }),
      });
    }
    bodyStream = r2Obj.body;
  } else {
    bodyStream = streamShards(env, new URL(request.url).origin, start, end);
  }

  if (!isPartial && edgeCache && ctx?.waitUntil) {
    const [clientStream, cacheStream] = bodyStream.tee();
    ctx.waitUntil(
      edgeCache
        .put(cacheKey, new Response(cacheStream, { status: 200, headers: baseHeaders }))
        .catch(() => {}),
    );
    return new Response(clientStream, { status: 200, headers: baseHeaders });
  }

  return new Response(bodyStream, { status: isPartial ? 206 : 200, headers: baseHeaders });
}

export const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2563eb"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === SF2_PATH) {
      return serveSoundFont(request, env, ctx);
    }
    if (pathname === '/favicon.ico') {
      return new Response(request.method === 'HEAD' ? null : FAVICON_SVG, {
        status: 200,
        headers: securityHeaders({
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        }),
      });
    }
    if (pathname.startsWith('/_bank_shards/')) {
      return new Response('Not Found', {
        status: 404,
        headers: securityHeaders({ 'Cache-Control': 'no-store' }),
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
    return env.ASSETS.fetch(request);
  },
};
