# Optional entry bundling & Cloudflare Workers self-hosting

The released `static/index.html` loads checked, content-hashed app and melody-worker bundles. Original modules remain beside them. For local source editing, change its module script URL to `./ui/app.js` and reload; that development route needs no bundler. Editing raw modules alone does not change an existing bundle.

The helpers in `hosting/` are provided for self-hosters who want faster web startup or static edge deployment.

## 1. Optional immutable entry bundling (`bundle_entry.cjs`)

`hosting/bundle_entry.cjs` collapses the startup ES module graph (`static/ui/app.js` and `static/ui/melody_composer_worker.js`) into content-hashed bundles using a pinned `esbuild@0.28.2` installation while preserving dynamic `AudioWorklet` and SoundFont URLs and recording `BUNDLE-PROVENANCE.json`.

Run it only in a new, separate staging directory. Copy the source files into that directory while excluding `.git/`, `MANIFEST.json`, `BUNDLE-PROVENANCE.json` and generated `*.bundle.js` files. In that scratch copy only, set the module script in `static/index.html` to `./ui/app.js`. Keep the checked release unchanged. The helper refuses a finalized stage or stale generated output; an ordinary clone already contains these artifacts and is not a fresh stage.

```bash
node hosting/bundle_entry.cjs --root <fresh-stage-directory> --esbuild <path-to-esbuild-0.28.2>
node hosting/bundle_entry.cjs --root <fresh-stage-directory> --verify 1
```

> Note: `bundle_entry.cjs` admits the reviewed `esbuild@0.28.2` API and Windows x64 binary hashes. Other build platforms have not been admitted by this release process. Do not remove integrity checks to call a different build verified. Use the modular development route, or independently validate and record a new toolchain for your fork.

After a successful build, generate a fresh `MANIFEST.json` over the final stage bytes and verify the actual bundled browser journey. Never copy the old manifest onto changed files.

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
