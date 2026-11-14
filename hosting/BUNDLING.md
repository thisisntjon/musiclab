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

## 2. Cloudflare Workers Static Assets stage

The stage helper verifies the package inventory and emits the entire hosting wrapper: the Worker, headers, entry redirects and a proper 404 page. The app uses the 11.7 MB MusicLab36 sound bank. The complete 32.3 MB source bank remains in the download for local customization; the hosted stage does not serve it. There are no shard or R2 modes in this version.

Use a reviewed, finalized package. Compute its manifest SHA-256 with `sha256sum MANIFEST.json` (macOS: `shasum -a 256 MANIFEST.json`; PowerShell: `Get-FileHash MANIFEST.json -Algorithm SHA256`). Pass that exact digest:

```bash
node hosting/stage-musiclab-cloudflare.mjs --pkg <verified-release-directory> --out <new-deploy-directory> --expect-manifest-sha <64-character-sha256> --worker-name <your-worker-name>
```

Inspect the generated `wrangler.json` before deployment. Choose your own Worker name and Cloudflare account, and configure a custom domain for it in Cloudflare. The generated config does not assign a domain. `workers_dev` and preview URLs are disabled. Test the generated stage with `wrangler dev --local` and your actual browser before deploying with `wrangler deploy` from the stage directory. The helper itself never deploys.

Keep host-injected analytics disabled on the app hostname. The wrapper uses same-origin resource/opener policies and a restrictive content security policy. Songs stay in the browser; hosting providers may separately collect request or network-error data as described in [SECURITY.md](../SECURITY.md).

## 3. Packaging a changed fork

The published `MANIFEST.json` identifies the original app candidate and hashes each included file. It is an integrity inventory, not proof that changed code has been tested. Source edits invalidate both that inventory and the original bundle provenance.

For ordinary local edits, use the source entry described above; no release packaging is needed. For a distributable fork, export only the reviewed files into a new directory, build and verify its bundles if used, and create an inventory over those final files with your own revision identifier. Do not stage your working directory, caches, credentials, saved songs or Git history. The upstream private release exporter is not included in this repository; self-hosters must review their own package inventory before computing its manifest digest.
