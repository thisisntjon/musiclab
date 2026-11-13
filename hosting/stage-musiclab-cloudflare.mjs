#!/usr/bin/env node
// Stages an immutable make_release.py package into a Cloudflare Workers Static Assets
// deployment directory without modifying the source package or MANIFEST.json.
//
// Usage:
//   node stage-musiclab-cloudflare.mjs --pkg <release_pkg_dir> --out <deploy_dir> [--mode shards|r2]
//     [--worker-name musiclab] [--r2-bucket musiclab-assets]
//
// Modes:
//   --mode r2     : Excludes the 30.82 MiB .sf2 from static assets and binds R2 bucket
//                   `SOUND_BANK` (`wrangler r2 object put <bucket>/GeneralUser-GS-2.0.3.sf2 ...`).
//   --mode shards : Zero-R2 mode (default if R2 is not enabled on the Cloudflare account).
//                   Splits the verified .sf2 into two <25 MiB static shards (16.00 MiB + 14.82 MiB)
//                   under `public/_bank_shards/`, omits the raw 30.82 MiB file from `public/`,
//                   and serves byte-exact `/static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2`
//                   (with 200, 206 Range, HEAD, and immutable SHA-256 ETag) from `worker.mjs`.

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, stat, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP_HEADER, SF2_PATH, SF2_SHA256, SF2_TOTAL_BYTES } from './musiclab-worker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARD_SIZE = 16 * 1024 * 1024; // 16 MiB (< 25 MiB Cloudflare Static Assets ceiling)

function parseArgs(argv) {
  const args = {
    mode: 'shards',
    workerName: 'musiclab',
    r2Bucket: 'musiclab-assets',
  };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--pkg') args.pkg = val, i++;
    else if (key === '--out') args.out = val, i++;
    else if (key === '--mode') args.mode = val, i++;
    else if (key === '--worker-name') args.workerName = val, i++;
    else if (key === '--r2-bucket') args.r2Bucket = val, i++;
    else throw new Error(`Unknown argument: ${key}`);
  }
  if (!args.pkg || !args.out) {
    throw new Error('Required: --pkg <release_pkg_dir> --out <deploy_dir>');
  }
  if (args.mode !== 'shards' && args.mode !== 'r2') {
    throw new Error(`Invalid --mode "${args.mode}" (expected "shards" or "r2")`);
  }
  return args;
}

const headersFile = csp => `# Security and caching headers for musiclab.simoneresearch.com
# Cloudflare Web Analytics must stay disabled on this hostname so song sessions emit zero beacons.
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), microphone=(self), camera=(), payment=(), usb=(), interest-cohort=()
  Content-Security-Policy: ${csp}

/MANIFEST.json
  Cache-Control: public, max-age=60, must-revalidate

/index.html
  Cache-Control: public, max-age=300, must-revalidate

/static/index.html
  Cache-Control: public, max-age=300, must-revalidate

/static/parents.html
  Cache-Control: public, max-age=300, must-revalidate

/static/vendor/sampled-piano/*
  Cache-Control: public, max-age=86400
`;

// Validate every payload before deriving policy or producing a deployment tree.
export async function verifyPackage(pkgDir, manifest) {
 if(manifest.version!==1||manifest.publication_approved!==false||!manifest.files)throw new Error('Unsupported package manifest');
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

async function main() {
  const args = parseArgs(process.argv);
  const pkgDir = path.resolve(args.pkg);
  const outDir = path.resolve(args.out);
  const relativeOut = path.relative(pkgDir.toLowerCase(),outDir.toLowerCase());
  if(!relativeOut || (!relativeOut.startsWith('..'+path.sep) && relativeOut!=='..' && !path.isAbsolute(relativeOut)))throw new Error('Output must be outside the immutable package');


  try {
    await stat(outDir);
    throw new Error(`Output directory already exists: ${outDir}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const sf2Src = path.join(pkgDir, 'static', 'vendor', 'sampled-piano', 'GeneralUser-GS-2.0.3.sf2');
  const sf2Bytes = await readFile(sf2Src);
  const actualSha = createHash('sha256').update(sf2Bytes).digest('hex');
  if (sf2Bytes.byteLength !== SF2_TOTAL_BYTES || actualSha !== SF2_SHA256) {
    throw new Error(
      `SoundFont integrity mismatch: got ${sf2Bytes.byteLength} bytes sha256=${actualSha}`,
    );
  }

  const manifestRaw = await readFile(path.join(pkgDir, 'MANIFEST.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const verifiedFiles = await verifyPackage(pkgDir, manifest);
  const csp = packageCsp(await readFile(path.join(pkgDir,'static/index.html'),'utf8'));
  if (manifest.files?.['static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2'] !== SF2_SHA256) {
    throw new Error('MANIFEST.json does not match expected SoundFont SHA-256');
  }

  // Copy only web-served assets + public notices/manifest (never Python server or test suites)
  // into `public/`, keeping `worker.mjs` and `wrangler.json` cleanly outside `assets.directory`.
  const publicDir = path.join(outDir, 'public');
  await mkdir(publicDir, { recursive: true });
  for (const rel of ['index.html', 'LICENSE', 'NOTICES.md', 'README.md', 'MANIFEST.json']) {
    await cp(path.join(pkgDir, rel), path.join(publicDir, rel));
  }
  await cp(path.join(pkgDir, 'static'), path.join(publicDir, 'static'), {
    recursive: true,
    filter: (src) => path.basename(src) !== 'GeneralUser-GS-2.0.3.sf2',
  });
  await cp(path.join(pkgDir, 'examples'), path.join(publicDir, 'examples'), { recursive: true });
  await cp(path.join(pkgDir, 'presets'), path.join(publicDir, 'presets'), { recursive: true });

  if (args.mode === 'shards') {
    const shardDir = path.join(publicDir, '_bank_shards');
    await mkdir(shardDir, { recursive: true });
    const part0 = sf2Bytes.subarray(0, SHARD_SIZE);
    const part1 = sf2Bytes.subarray(SHARD_SIZE);
    await writeFile(path.join(shardDir, 'GeneralUser-GS-2.0.3.sf2.part0'), part0);
    await writeFile(path.join(shardDir, 'GeneralUser-GS-2.0.3.sf2.part1'), part1);
  }

  const workerSrc = await readFile(path.join(HERE, 'musiclab-worker.mjs'), 'utf8');
  // workerd interprets named exports as entrypoints; helper constants are not entrypoints.
  const entry = workerSrc.replace(/^export (const|function) /gm,'$1 ').replace('__MUSICLAB_SCRIPT_HASHES__',csp.match(/script-src ([^;]+)/)[1].match(/'sha256-[^']+'/g).join(' '));
  await writeFile(path.join(outDir, 'worker.mjs'), entry, 'utf8');
  await writeFile(path.join(publicDir, '_headers'), headersFile(csp), 'utf8');
  await writeFile(
    path.join(publicDir, '.assetsignore'),
    ['static/vendor/sampled-piano/GeneralUser-GS-2.0.3.sf2', ''].join('\n'),
    'utf8',
  );

  const runWorkerFirst = [SF2_PATH, '/favicon.ico', '/api/*'];
  if (args.mode === 'shards') runWorkerFirst.push('/_bank_shards/*');

  const wranglerConfig = {
    name: args.workerName,
    compatibility_date: '2025-10-08',
    main: './worker.mjs',
    assets: {
      directory: './public',
      binding: 'ASSETS',
      not_found_handling: 'none',
      run_worker_first: runWorkerFirst,
    },
    ...(args.mode === 'r2'
      ? {
          r2_buckets: [
            {
              binding: 'SOUND_BANK',
              bucket_name: args.r2Bucket,
            },
          ],
        }
      : {}),
    observability: {
      enabled: false,
    },
  };
  await writeFile(
    path.join(outDir, 'wrangler.json'),
    JSON.stringify(wranglerConfig, null, 2) + '\n',
    'utf8',
  );

  console.log(
    JSON.stringify({
      ok: true,
      mode: args.mode,
      outDir,
      commit: manifest.commit || null,
      verifiedFiles,
      csp,
      manifestSha256: createHash('sha256').update(manifestRaw).digest('hex'),
      sf2Bytes: sf2Bytes.byteLength,
      sf2Sha256: actualSha,
    }),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
