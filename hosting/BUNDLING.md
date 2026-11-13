# Optional entry bundling & Cloudflare Workers self-hosting

Local development and `python app.py` need **no bundling** — `static/index.html` loads `./ui/app.js` directly as native ES modules so you can edit files and reload immediately.

The helpers in `hosting/` are provided for self-hosters who want faster web startup or static edge deployment.

## 1. Optional immutable entry bundling (`bundle_entry.cjs`)

`hosting/bundle_entry.cjs` collapses the startup ES module graph (`static/ui/app.js` and `static/ui/melody_composer_worker.js`) into content-hashed bundles using a pinned `esbuild@0.28.2` installation while preserving dynamic `AudioWorklet` and SoundFont URLs and recording `BUNDLE-PROVENANCE.json`.

Run it only against a fresh copy of the repository (before generating `MANIFEST.json`):

```bash
node hosting/bundle_entry.cjs --root <fresh-stage-directory> --esbuild <path-to-esbuild-0.28.2>
node hosting/bundle_entry.cjs --root <fresh-stage-directory> --verify 1
```

> Note: `bundle_entry.cjs` pins `esbuild@0.28.2` API and `@esbuild/win32-x64` binary SHA-256 digests for reproducible release builds; if you bundle on macOS or Linux, update or relax `loadTool()` in your fork's copy of `hosting/bundle_entry.cjs`.

Hashed bundles (`*.<sha256>.bundle.js`) may be cached immutably. Entry HTML (`index.html`, `static/index.html`) and `MANIFEST.json` must revalidate (`must-revalidate`); do not apply indefinite cache headers to HTML.

## 2. Cloudflare Workers Static Assets stage (`stage-musiclab-cloudflare.mjs`)

`static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2` is `32,319,396` bytes (`30.82 MiB`), which exceeds Cloudflare Workers Static Assets' `25 MiB` per-file ceiling. `hosting/stage-musiclab-cloudflare.mjs` stages a verified release directory into a ready-to-deploy Wrangler directory (`wrangler.json`, `worker.mjs`, `public/_headers`) that:

1. Verifies every file against `MANIFEST.json` and computes exact SHA-256 `Content-Security-Policy` hashes for `static/index.html`.
2. Copies only web-served files (`index.html`, `static/`, `presets/`, `examples/`, `LICENSE`, `NOTICES.md`, `README.md`, `MANIFEST.json`) into `public/`.
3. Serves byte-exact `/static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2` (including `206 Partial Content` byte ranges and `ETag`) either from two `< 25 MiB` static shards (`--mode shards`, zero R2 account required) or from a bound R2 bucket (`--mode r2`).

```bash
node hosting/stage-musiclab-cloudflare.mjs \
  --pkg <verified-release-directory> \
  --out <new-deploy-directory> \
  --mode shards \
  --worker-name musiclab
```

Then deploy from `<new-deploy-directory>` with `npx wrangler deploy`. Keep Cloudflare Web Analytics and automatic script injection disabled on your hostname so `connect-src 'self'` and `script-src` remain completely clean.
