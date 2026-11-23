const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),base=require('../projects/material-design/baseline.json');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const contract=html=>[...html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/g)].map(m=>({tag:m[1],attributes:[...m[2].matchAll(/\b(id|data-[\w-]+|name|type|action|method|for|aria-[\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])})).filter(e=>e.attributes.length);
test('Material foundation preserves every existing DOM contract and script',()=>{
 const html=read('index.html');assert.deepEqual(contract(html),base.indexContract);
 const withoutTheme=html.replace(/<link rel="stylesheet" href="design-system\/[^"]+">/g,'').replace(/\s+/g,' ').trim();
 assert.equal(hash(withoutTheme),base.indexNormalizedHash);
 assert(!/<script\b[^>]*>\s*[^<\s]/.test(html));assert(!/\son(?:click|submit|change|input)=/.test(html));
});
test('Material foundation leaves domain APIs authentication and queues byte identical',()=>{
 for(const [file,expected]of Object.entries(base.files)){
  if(file==='index.html')continue;
  let source=fs.readFileSync(path.join(root,file));
  if(['group-courses-ui.js','sandbox/repertoire-ui.js','sandbox/preview-production.cjs'].includes(file))source=source.toString('utf8');
  if(['group-courses-ui.js','sandbox/repertoire-ui.js'].includes(file))source=source.replace('design-system/group-courses.css?v=material-foundation-20261123','group-courses.css?v=improvements-20261122');
  if(file==='sandbox/preview-production.cjs')source=source.replace("['design-system/tokens.css','design-system/components.css','design-system/legacy-bridge.css','design-system/group-courses.css'].forEach(file=>files.add(file));\n",'');
  assert.equal(hash(source),expected,'Unexpected non-presentation change in '+file);
 }
});
test('Material foundation reaches the page and both isolated roots using local CSS only',()=>{
 const html=read('index.html'),template=html.slice(html.indexOf('<template id="repertoire-template">'));
 for(const file of ['tokens.css','components.css','legacy-bridge.css']){
  assert.equal(html.split('design-system/'+file+'?v=').length-1,2,file);
  assert(template.includes('design-system/'+file));
 }
 for(const file of ['group-courses-ui.js','sandbox/repertoire-ui.js'])assert(read(file).includes('design-system/group-courses.css?v=material-foundation-20261123'));
 for(const file of ['tokens.css','components.css','legacy-bridge.css','group-courses.css']){
  const css=read('design-system/'+file);
  assert(!/https?:|javascript:|expression\s*\(/i.test(css));
  for(const m of css.matchAll(/@import url\("([^"]+)"\)/g))assert(fs.existsSync(path.resolve(root,'design-system',m[1])));
 }
});
