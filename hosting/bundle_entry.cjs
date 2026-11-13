// Release packaging helper. Existing installed tool only; no downloads or authoring-source edits.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const VERSION=1,RECORD='BUNDLE-PROVENANCE.json';
const SITES={'static/js/audio/sampled_piano.js':1,'static/js/audio/sampled_bank_delivery.js':1,'static/js/theory/instrument_catalogue.js':2,'static/ui/stages/play_flow.js':1,'static/ui/melody_field_session.js':1};
const DYNAMIC_IMPORTS={'static/ui/app.js':2,'static/js/audio/sampled_piano.js':1};
const OPTIONS={format:'esm',platform:'browser',bundle:true,minify:false,treeShaking:false,legalComments:'inline',sourcemap:false};
const inside=(base,file)=>{const rel=path.relative(base.toLowerCase(),file.toLowerCase());return !rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
const fileAt=(root,rel)=>{if(typeof rel!=='string'||rel.includes('\\')||path.posix.isAbsolute(rel)||rel.split('/').includes('..'))throw Error('Nonrelative artifact path');const file=path.resolve(root,rel);if(!inside(root,file))throw Error('Path outside stage');return file;};
const sorted=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
function checkedInput(root,file){if(!inside(root,file))throw Error('Build input outside stage');const real=fs.realpathSync(file);if(real!==file||!inside(root,real))throw Error('Linked build input');return fs.readFileSync(file);}
function loadTool(modulePath){
 if(!modulePath)throw Error('Provide the existing esbuild module with --esbuild');
 if(process.env.ESBUILD_BINARY_PATH)throw Error('Unreviewed ESBUILD_BINARY_PATH override');
 const resolved=require.resolve(path.resolve(modulePath));
 const apiHash=sha(fs.readFileSync(resolved));
 if(apiHash!=='61ec0ba144ff93f4bf0e96ad6fab6f430ede0aa13e27ace8063ed63ba416b3cd')throw Error('Unreviewed esbuild API bytes');
 const tool=require(resolved);
 if(tool.version!=='0.28.2')throw Error('Expected reviewed esbuild0.28.2; do not install automatically');
 const pkg=`@esbuild/${process.platform}-${process.arch}`,exe=process.platform==='win32'?'esbuild.exe':'bin/esbuild';
 const native=require.resolve(pkg+'/'+exe,{paths:[path.dirname(resolved)]});
 if(pkg!=='@esbuild/win32-x64'||sha(fs.readFileSync(native))!=='c7bee37877d0aa6a046e52783fa0a2cf1a9ce5579d68bb3083bda99d4bff18ef')throw Error('Unreviewed esbuild native binary');
 return {tool,identity:{version:tool.version,api_sha256:sha(fs.readFileSync(resolved)),native_package:pkg,native_sha256:sha(fs.readFileSync(native)),node_version:process.version}};
}
function assertImports(result,allowed){
 for(const [file,output]of Object.entries(result.metafile.outputs))for(const item of output.imports)if(!allowed.includes(item.path)||!item.external||item.kind!=='dynamic-import')throw Error('Unreviewed emitted import '+file+': '+item.path);
}
async function buildStage(rootPath,modulePath){
 const root=fs.realpathSync(rootPath);
 for(const name of ['MANIFEST.json',RECORD])if(fs.existsSync(path.join(root,name)))throw Error('Stage already finalized/generated: '+name);
 const ui=path.join(root,'static/ui');if(fs.readdirSync(ui).some(n=>/^(app|melody_composer_worker)\.[0-9a-f]+\.bundle\.js$/.test(n)||['app.bundle.js','melody_composer_worker.bundle.js'].includes(n)))throw Error('Stage has stale generated bundles');
 const {tool,identity}=loadTool(modulePath),sourceInputs={},rebased=[];
 const indexPath=path.join(root,'static/index.html'),index=checkedInput(root,indexPath).toString('utf8'),needle='src="./ui/app.js"';
 if(index.split(needle).length!==2)throw Error('Expected exactly one raw app entry');
 // Worker first: its hashed URL becomes part of app bytes, avoiding cross-release worker mixing.
 const worker=await tool.build({...OPTIONS,absWorkingDir:root,entryPoints:['static/ui/melody_composer_worker.js'],outfile:'static/ui/melody_composer_worker.bundle.js',write:false,metafile:true,logLevel:'silent'});
 assertImports(worker,[]);
 if(worker.warnings.length||worker.outputFiles.length!==1||worker.outputFiles[0].text.includes('import.meta.url'))throw Error('Worker URL/warning/output requires review');
 for(const rel of Object.keys(worker.metafile.inputs)){const bytes=checkedInput(root,fileAt(root,rel));if(/\bimport\s*\(/.test(bytes.toString('utf8')))throw Error('Unreviewed dynamic worker import: '+rel);sourceInputs[rel]=sha(bytes);}
 const workerBytes=worker.outputFiles[0].contents,workerHash=sha(workerBytes),workerName=`melody_composer_worker.${workerHash}.bundle.js`,workerRel='static/ui/'+workerName;
 const rebase={name:'preserve-reviewed-source-url',setup(build){build.onLoad({filter:/\.js$/},entry=>{
  const bytes=checkedInput(root,entry.path),rel=path.relative(root,entry.path).split(path.sep).join('/');let text=bytes.toString('utf8');
  sourceInputs[rel]=sha(bytes);const count=(text.match(/import\.meta\.url/g)||[]).length;
  if(count!==(SITES[rel]||0))throw Error('Unreviewed import.meta.url site: '+rel);
  if((text.match(/\bimport\s*\(/g)||[]).length!==(DYNAMIC_IMPORTS[rel]||0))throw Error('Unreviewed dynamic import: '+rel);
  if(rel==='static/js/audio/sampled_piano.js'&&text.split("import(new URL('engine.js', base))").length!==2)throw Error('External sampled engine import changed');
  if(rel==='static/ui/melody_field_session.js'){
   const from="new Worker(new URL('./melody_composer_worker.js',import.meta.url)";
   if(text.split(from).length!==2)throw Error('Worker expression changed');
   text=text.replace(from,"new Worker(new URL('./"+workerName+"',import.meta.url)");
  }
  if(count){let relative=path.posix.relative('static/ui',rel);if(!relative.startsWith('.'))relative='./'+relative;
   for(const [origin,expectedPrefix]of [['https://example.invalid/static/ui/app.bundle.js','https://example.invalid/'],['https://example.invalid/musiclab/static/ui/app.bundle.js','https://example.invalid/musiclab/'],['http://127.0.0.1:8796/ui/app.bundle.js','http://127.0.0.1:8796/']]){
    const expected=expectedPrefix+(origin.includes('/static/ui/')?rel:rel.replace(/^static\//,''));
    if(new URL(relative,origin).href!==expected)throw Error('Module URL rebase mismatch: '+rel);
   }
   text=text.replaceAll('import.meta.url','(new URL('+JSON.stringify(relative)+', import.meta.url).href)');rebased.push({source:rel,count,relative});
  }
  return {contents:text,loader:'js',resolveDir:path.dirname(entry.path)};
 });}};
 const app=await tool.build({...OPTIONS,absWorkingDir:root,entryPoints:['static/ui/app.js'],outfile:'static/ui/app.bundle.js',write:false,metafile:true,external:['./selftest.js'],plugins:[rebase],logLevel:'silent'});
 assertImports(app,['./selftest.js']);
 for(const rel of Object.keys(SITES))if(!rebased.some(x=>x.source===rel))throw Error('Expected URL site absent: '+rel);
 if(app.outputFiles.length!==1)throw Error('Unexpected app code splitting');
 const warnings=app.warnings.map(w=>({id:w.id,text:w.text,file:w.location?.file}));
 if(warnings.length!==1||warnings[0].id!=='duplicate-class-member'||!warnings[0].text.includes('_legendHtml')||warnings[0].file!=='static/ui/stages/play_flow.js')throw Error('Unreviewed build warnings');
 // Catch future non-JS build inputs too; do not assume the current extension set.
 for(const rel of Object.keys(app.metafile.inputs))sourceInputs[rel]=sha(checkedInput(root,fileAt(root,rel)));
 const appBytes=app.outputFiles[0].contents,appHash=sha(appBytes),appRel=`static/ui/app.${appHash}.bundle.js`;
 const finalIndex=index.replace(needle,'src="./ui/'+path.posix.basename(appRel)+'"');
 const record={version:VERSION,recipe_sha256:sha(fs.readFileSync(__filename)),tool:identity,options:{...OPTIONS,app_external:['./selftest.js'],worker_external:[]},source_inputs:sorted(sourceInputs),rebase:rebased.sort((a,b)=>a.source.localeCompare(b.source)),warnings,
  original_index_sha256:sha(Buffer.from(index)),index_sha256:sha(Buffer.from(finalIndex)),outputs:[{kind:'app',path:appRel,bytes:appBytes.length,sha256:appHash},{kind:'worker',path:workerRel,bytes:workerBytes.length,sha256:workerHash}],
  cache_policy:'Hashed app and worker may be immutable. HTML and provenance must revalidate; do not cache entry HTML indefinitely.',limits:['Source checks supplement actual bundled journey and negative controls','External selftest exercises separate raw module instances','No guarantee for unrelated transport failures']};
 // Build sources must not change while the artifacts are computed.
 for(const [rel,h]of Object.entries(sourceInputs))if(sha(checkedInput(root,fileAt(root,rel)))!==h)throw Error('Source changed during build: '+rel);
 if(checkedInput(root,indexPath).toString('utf8')!==index)throw Error('Entry changed during build');
 for(const entry of record.outputs)if(fs.existsSync(fileAt(root,entry.path)))throw Error('Refusing output overwrite');
 fs.writeFileSync(fileAt(root,appRel),appBytes);fs.writeFileSync(fileAt(root,workerRel),workerBytes);fs.writeFileSync(indexPath,finalIndex);
 fs.writeFileSync(path.join(root,RECORD),JSON.stringify(record,null,2)+'\n');
 return verifyStage(root);
}
function verifyStage(rootPath){
 const root=fs.realpathSync(rootPath),p=JSON.parse(fs.readFileSync(path.join(root,RECORD),'utf8'));
 if(p.version!==VERSION||p.tool.version!=='0.28.2'||p.recipe_sha256!==sha(fs.readFileSync(__filename)))throw Error('Recipe/tool provenance mismatch');
 for(const [rel,h]of Object.entries(p.source_inputs))if(sha(fs.readFileSync(fileAt(root,rel)))!==h)throw Error('Stale bundle input: '+rel);
 for(const o of p.outputs){const b=fs.readFileSync(fileAt(root,o.path));if(b.length!==o.bytes||sha(b)!==o.sha256||!o.path.includes('.'+o.sha256+'.bundle.js'))throw Error('Modified bundle: '+o.path);}
 const index=fs.readFileSync(path.join(root,'static/index.html'),'utf8'),app=p.outputs.find(x=>x.kind==='app'),worker=p.outputs.find(x=>x.kind==='worker');
 const entry='src="./ui/'+path.posix.basename(app.path)+'"';
 if(sha(Buffer.from(index))!==p.index_sha256||index.split(entry).length!==2||sha(Buffer.from(index.replace(entry,'src="./ui/app.js"')))!==p.original_index_sha256)throw Error('Entry differs from bundled record');
 if(!fs.readFileSync(fileAt(root,app.path),'utf8').includes(path.posix.basename(worker.path)))throw Error('App does not reference recorded worker');
 return {pass:true,input_modules:Object.keys(p.source_inputs).length,outputs:p.outputs,tool:p.tool};
}
module.exports={buildStage,verifyStage};
if(require.main===module){const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
 if(!args.root)throw Error('Use --root <fresh sanitized stage> --esbuild <existing installed module>');
 Promise.resolve(args.verify?verifyStage(args.root):buildStage(args.root,args.esbuild)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.stack);process.exitCode=1;});}
