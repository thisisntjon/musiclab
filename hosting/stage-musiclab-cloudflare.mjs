#!/usr/bin/env node
// Stages an immutable make_release.py package into a Cloudflare Workers Static Assets deployment folder without
// modifying the package or MANIFEST.json. It emits the whole hosting wrapper that runs live: worker.mjs,
// wrangler.json, public/_headers, public/_redirects, public/.assetsignore and public/404.html. Nothing is laid over
// it by hand afterwards.
//
// Usage:
//   node stage-musiclab-cloudflare.mjs --pkg <release_pkg_dir> --out <deploy_dir> --expect-manifest-sha <sha256>
//     [--worker-name musiclab]
//
// --expect-manifest-sha is the sha256 of the package's MANIFEST.json as recorded by the QA run and named in the
// owner's approval. Any other package is refused, so a rebuilt or altered package with a regenerated manifest is
// never staged by mistake.
//
// What the wrapper does:
// - /, /static, /static/ and /index.html redirect (302, no-store) to /static/index.html (public/_redirects).
// - The entry pages revalidate every 300 s with no-transform; css, js and ui files revalidate every hour; vendor
//   files are cached for a day. Every response carries the security headers, with COOP and CORP same-origin.
// - The Worker runs first only for /favicon.ico and /api/*. Unknown paths get the small 404.html page.
// - The unmodified full source bank stays in the package for reproducibility; it is not staged or served.
// - workers.dev and preview URLs are off, so the custom domain is the only origin.

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP_HEADER, SF2_PATH, SF2_SHA256, SF2_TOTAL_BYTES } from './musiclab-worker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FULL_BANK = SF2_PATH.slice(1);
export const ENTRY_ALIASES = ['/', '/static', '/static/', '/index.html'];
export const RUN_WORKER_FIRST = ['/favicon.ico', '/api/*'];

function parseArgs(argv) {
  const args = { workerName: 'musiclab' };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--pkg') args.pkg = val, i++;
    else if (key === '--out') args.out = val, i++;
    else if (key === '--expect-manifest-sha') args.expectManifestSha = val, i++;
    else if (key === '--worker-name') args.workerName = val, i++;
    else throw new Error(`Unknown argument: ${key}`);
  }
  if (!args.pkg || !args.out) throw new Error('Required: --pkg <release_pkg_dir> --out <deploy_dir> --expect-manifest-sha <sha256>');
  return args;
}

export const headersFile = csp => `# Security and caching headers for musiclab.simoneresearch.com
# Host-injected requests must be evaluated separately from application requests.
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), microphone=(self), camera=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Content-Security-Policy: ${csp}

# Entry aliases redirect to /static/index.html (_redirects); the redirect itself is never cached.
${ENTRY_ALIASES.map(alias => `${alias}\n  Cache-Control: no-store\n`).join('\n')}
/MANIFEST.json
  Cache-Control: public, max-age=60, must-revalidate

/static/index.html
  Cache-Control: public, max-age=300, must-revalidate, no-transform

/static/parents.html
  Cache-Control: public, max-age=300, must-revalidate, no-transform

/static/vendor/sampled-piano/*
  Cache-Control: public, max-age=86400

/static/css/*
  Cache-Control: public, max-age=3600, must-revalidate

/static/js/*
  Cache-Control: public, max-age=3600, must-revalidate

/static/ui/*
  Cache-Control: public, max-age=3600, must-revalidate
`;

export const redirectsFile = () => `# Entry aliases: one hop to the app, served by static assets without the Worker.
${ENTRY_ALIASES.map(alias => `${alias} /static/index.html 302`).join('\n')}
`;

export const wranglerConfig = workerName => ({
  name: workerName,
  compatibility_date: '2025-10-08',
  main: './worker.mjs',
  // The custom domain is the only origin: no second copy with separate saves on workers.dev or preview URLs.
  workers_dev: false,
  preview_urls: false,
  assets: {
    directory: './public',
    binding: 'ASSETS',
    not_found_handling: '404-page',
    run_worker_first: RUN_WORKER_FIRST,
    html_handling: 'none',
  },
  observability: {
    enabled: false,
  },
});

// Validate every payload before deriving policy or producing a deployment tree.
export async function verifyPackage(pkgDir, manifest) {
 // Older packages carry "publication_approved": false; a manifest must never claim approval.
 if(manifest.version!==1||(manifest.publication_approved??false)!==false||!manifest.files)throw new Error('Unsupported package manifest');
 const actual={};
 async function walk(dir,prefix='') {
  for(const e of await readdir(dir,{withFileTypes:true})) {
   const rel=prefix+e.name;
   if(e.isSymbolicLink())throw new Error('Package links are not supported');
   if(e.isDirectory())await walk(path.join(dir,e.name),rel+'/');
   else if(rel!=='MANIFEST.json')actual[rel]=createHash('sha256').update(await readFile(path.join(dir,e.name))).digest('hex');
  }
 }
 await walk(pkgDir);
 const expected=Object.keys(manifest.files).sort();
 if(JSON.stringify(Object.keys(actual).sort())!==JSON.stringify(expected)||expected.some(f=>actual[f]!==manifest.files[f]))throw new Error('Package inventory or content differs from MANIFEST.json');
 return expected.length;
}
export function packageCsp(html) {
 // HTML normalizes line endings before executing an inline script.
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 const boot=scripts.filter(m=>/\bid=["']boot-check["']/.test(m[1]));
 if(boot.length!==1||scripts.some(m=>m[2].trim()&&!/\bid=["']boot-check["']/.test(m[1])))throw new Error('Review changed inline scripts before staging');
 const handlers=[...html.matchAll(/\bon\w+="([^"]*)"/g)].map(m=>m[1]);
 if(handlers.some(h=>h!=='musicLabBootFailed()'))throw new Error('Review changed inline event handlers before staging');
 const hashes=[boot[0][2].replace(/\r\n?/g,'\n'),...new Set(handlers)].map(s=>"'sha256-"+createHash('sha256').update(s).digest('base64')+"'");
 return CSP_HEADER.replace('__MUSICLAB_SCRIPT_HASHES__',hashes.join(' '));
}

export async function stagePackage({ pkg, out, expectManifestSha, workerName = 'musiclab' }) {
  if (!/^[0-9a-f]{64}$/.test(String(expectManifestSha || ''))) {
    throw new Error('Pass --expect-manifest-sha <sha256 of the approved MANIFEST.json>; nothing is staged without it');
  }
  const pkgDir = path.resolve(pkg);
  const outDir = path.resolve(out);
  const relativeOut = path.relative(pkgDir.toLowerCase(), outDir.toLowerCase());
  if (!relativeOut || (!relativeOut.startsWith('..' + path.sep) && relativeOut !== '..' && !path.isAbsolute(relativeOut))) {
    throw new Error('Output must be outside the immutable package');
  }
  try {
    await stat(outDir);
    throw new Error(`Output directory already exists: ${outDir}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const manifestRaw = await readFile(path.join(pkgDir, 'MANIFEST.json'));
  const manifestSha256 = createHash('sha256').update(manifestRaw).digest('hex');
  if (manifestSha256 !== expectManifestSha) {
    throw new Error(`MANIFEST.json sha256 ${manifestSha256} does not match the expected ${expectManifestSha}`);
  }
  const manifest = JSON.parse(manifestRaw.toString('utf8'));
  const verifiedFiles = await verifyPackage(pkgDir, manifest);
  // The package keeps the exact admitted source bank for reproducibility, even though it is not served.
  if (manifest.files[FULL_BANK] !== SF2_SHA256 || (await stat(path.join(pkgDir, FULL_BANK))).size !== SF2_TOTAL_BYTES) {
    throw new Error('MANIFEST.json does not hold the expected source SoundFont');
  }
  const csp = packageCsp(await readFile(path.join(pkgDir, 'static/index.html'), 'utf8'));
  const notFoundPage = await readFile(path.join(HERE, '404.html'));
  if (/<script\b|\son\w+=/i.test(notFoundPage.toString('utf8'))) throw new Error('404.html must not run script under the pinned policy');

  // Copy only web-served assets and the public notices/manifest (never the Python server or test suites) into
  // public/, keeping worker.mjs and wrangler.json outside assets.directory.
  const publicDir = path.join(outDir, 'public');
  await mkdir(publicDir, { recursive: true });
  for (const rel of ['index.html', 'LICENSE', 'NOTICES.md', 'README.md', 'MANIFEST.json']) {
    await cp(path.join(pkgDir, rel), path.join(publicDir, rel));
  }
  const fullBankSource = path.join(pkgDir, FULL_BANK);
  await cp(path.join(pkgDir, 'static'), path.join(publicDir, 'static'), {
    recursive: true,
    filter: src => path.resolve(src) !== fullBankSource,
  });
  await cp(path.join(pkgDir, 'examples'), path.join(publicDir, 'examples'), { recursive: true });
  await cp(path.join(pkgDir, 'presets'), path.join(publicDir, 'presets'), { recursive: true });

  const workerSrc = await readFile(path.join(HERE, 'musiclab-worker.mjs'), 'utf8');
  // workerd interprets named exports as entrypoints; helper constants are not entrypoints.
  const entry = workerSrc.replace(/^export (const|function) /gm, '$1 ').replace('__MUSICLAB_SCRIPT_HASHES__', csp.match(/script-src ([^;]+)/)[1].match(/'sha256-[^']+'/g).join(' '));
  await writeFile(path.join(outDir, 'worker.mjs'), entry, 'utf8');
  await writeFile(path.join(publicDir, '_headers'), headersFile(csp), 'utf8');
  await writeFile(path.join(publicDir, '_redirects'), redirectsFile(), 'utf8');
  await writeFile(path.join(publicDir, '404.html'), notFoundPage);
  await writeFile(path.join(publicDir, '.assetsignore'), [FULL_BANK, ''].join('\n'), 'utf8');
  await writeFile(path.join(outDir, 'wrangler.json'), JSON.stringify(wranglerConfig(workerName), null, 2) + '\n', 'utf8');

  return {
    ok: true,
    outDir,
    commit: manifest.commit || null,
    verifiedFiles,
    csp,
    manifestSha256,
    expectedManifestSha256: expectManifestSha,
    fullBankStaged: false,
    runWorkerFirst: RUN_WORKER_FIRST,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(JSON.stringify(await stagePackage(args)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
