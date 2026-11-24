const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),base=require('../projects/material-design/baseline.json');
const lf=s=>s.replace(/\r/g,'');
const lfBytes=source=>Buffer.from((Buffer.isBuffer(source)?source:Buffer.from(source)).toString('latin1').replace(/\r\n/g,'\n'),'latin1');
const canonical=require('../projects/material-design/source-lf-hashes.json');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const phase3=require('../projects/material-design/phase3-presentation.json'),phase4=require('../projects/material-design/phase4-presentation.json'),phase5=require('../projects/material-design/phase5-presentation.json'),phase6=require('../projects/material-design/phase6-presentation.json');
function originalPresentation(file,source){const norm=lf;source=norm(source);for(const patch of [...(phase6.files[file]||[])].reverse()){assert.equal(source.slice(patch.offset,patch.offset+patch.after.length),patch.after,'Missing phase 6 presentation patch in '+file);source=source.slice(0,patch.offset)+patch.before+source.slice(patch.offset+patch.after.length);}for(const patch of [...(phase5.files[file]||[])].reverse()){assert(source.includes(norm(patch.after)),'Missing phase 5 presentation patch in '+file);source=source.replace(norm(patch.after),norm(patch.before));}for(const patch of [...(phase4.files[file]||[])].reverse()){assert(source.includes(norm(patch.after)),'Missing phase 4 presentation patch in '+file);source=source.replace(norm(patch.after),norm(patch.before));}for(const patch of [...(phase3.files[file]||[])].reverse()){assert(source.includes(norm(patch.after)),'Missing presentation patch in '+file);source=source.replace(norm(patch.after),norm(patch.before));}return source;}
const contract=html=>[...html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/g)].map(m=>({tag:m[1],attributes:[...m[2].matchAll(/\b(id|data-[\w-]+|name|type|action|method|for|aria-[\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])})).filter(e=>e.attributes.length);
test('Material foundation preserves every existing DOM contract and script',()=>{
 const html=originalPresentation('index.html',read('index.html'));assert.deepEqual(contract(html),base.indexContract);
 const withoutTheme=html.replace(/<link rel="stylesheet" href="design-system\/[^"]+">/g,'').replace(/\s+/g,' ').trim();
 assert.equal(hash(withoutTheme),base.indexNormalizedHash);
 assert(!/<script\b[^>]*>\s*[^<\s]/.test(html));assert(!/\son(?:click|submit|change|input)=/.test(html));
});
test('Material foundation preserves domain APIs authentication and queues across line endings',()=>{
 assert.equal(canonical.commit,base.commit);
 for(const [file,expected]of Object.entries(base.files)){
  if(file==='index.html')continue;
  let source=fs.readFileSync(path.join(root,file));
  if(['group-courses-ui.js','sandbox/repertoire-ui.js','sandbox/preview-production.cjs',...Object.keys(phase3.files),...Object.keys(phase4.files),...Object.keys(phase5.files),...Object.keys(phase6.files)].includes(file))source=originalPresentation(file,source.toString('utf8'));
  if(['group-courses-ui.js','sandbox/repertoire-ui.js'].includes(file))source=source.replace('design-system/group-courses.css?v=material-foundation-20261123','group-courses.css?v=improvements-20261122');
  if(file==='group-courses-ui.js')for(const patch of require('../projects/material-design/filter-presentation.json').patches){assert(source.includes(lf(patch.after)));source=source.replace(lf(patch.after),lf(patch.before));}
  if(file==='sandbox/preview-production.cjs')source=source.replace("['design-system/tokens.css','design-system/components.css','design-system/legacy-bridge.css','design-system/group-courses.css'].forEach(file=>files.add(file));\n",'');
  assert.equal(hash(lfBytes(source)),canonical.files[file],'Unexpected non-presentation change in '+file);
 }
});
test('Material presentation loads one compiled entry per context and local CSS only',()=>{
 const html=read('index.html'),template=html.slice(html.indexOf('<template id="repertoire-template">'));
 assert(!/<style\b/.test(html));assert.equal((html.match(/design-system\/app.css\?v=/g)||[]).length,1);
 assert.equal((template.match(/<link\b/g)||[]).length,1);assert(template.includes('design-system/repertoire-bundle.css?v=material-final-20261124'));
 assert(read('group-courses-ui.js').includes('design-system/course-bundle.css?v=material-final-20261124'));
 assert(!read('sandbox/repertoire-ui.js').includes("root.append(style)"));
 const manifest=require('../design-system/build-manifest.json');
 for(const [file,expected]of Object.entries(manifest.inputs))assert.equal(hash(lf(read(file))),expected,'Style source changed; rebuild '+file);
 for(const [file,details]of Object.entries(manifest.outputs)){
  const css=lf(read(file));assert.equal(hash(css),details.sha256,'Stale generated stylesheet '+file);
  assert(!/@import\b|https?:|javascript:|expression\s*\(/i.test(css));
  assert(read('sandbox/preview-production.cjs').includes(file));
 }
 for(const file of ['app-views.js','map-picker.js','group-courses-ui.js','sandbox/repertoire-ui.js','design-system/presentation.js'])assert(html.includes('src="'+file+'?v=material-final-20261124"'));
});
