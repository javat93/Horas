const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,id,theme}=require('./fixtures/repertoire.cjs');
const S=require('./repertoire-service.cjs'),P=require('./repertoire-policy.cjs'),C=require('../repertoire-client.js');
const counts=f=>({reads:f.calls.filter(c=>c.method==='GET').length,writes:f.calls.filter(c=>c.method==='POST').length});
async function seeded(n=10){
  const f=fixture({rowCount:80});for(let i=1;i<=n;i++)await f.apply({action:'saveTheme',theme:theme(i)});
  await f.apply({action:'assignThemes',grupo:'Grupo A',assignments:Array.from({length:n},(_,i)=>({id:id(101+i),temaId:id(1+i)}))});
  await f.apply({action:'assignThemes',grupo:'Grupo B',assignments:[{id:id(500),temaId:id(1)}]});
  await f.apply({action:'updateProgress',vinculoId:id(101),changes:{notas:'Conservar nota',ultimoRepaso:'2026-11-01'}});
  const policy=P.createPolicy('production');f.book.spreadsheetId=policy.TARGET_ID;f.book.sheets[0].properties.sheetId=155111501;f.book.sheets[1].properties.sheetId=155111502;
  const service=S.createService(policy),run=p=>service.runRepertoire(p,'Bearer simulated',f.request,new Date('2026-11-16T10:00:00Z'));
  const data=await run({action:'validate'});f.calls.length=0;return {f,run,data,policy};
}
test('diez temas y veinte casillas se verifican con 4 lecturas y un solo batchUpdate',async()=>{
  const {f,run,data}=await seeded();const result=await run({action:'updateProgressBatch',updates:data.assignments.filter(a=>a.grupo==='Grupo A').map(a=>({vinculoId:a.id,changes:{realizado:true,repasando:true}})),expectedVersion:data.version});
  assert.deepEqual(counts(f),{reads:4,writes:1});assert.equal(f.calls.filter(c=>c.method==='GET'&&!new URL(c.url).searchParams.has('includeGridData')).length,1);
  assert.equal(new Set(f.calls.find(c=>c.method==='POST').body.requests.map(r=>r.updateCells.range.startRowIndex)).size,10);
  for(const a of result.assignments.filter(a=>a.grupo==='Grupo A')){assert(a.realizado&&a.repasando);assert.equal(a.fechaRealizado,'2026-11-16');}
  const first=result.assignments.find(a=>a.id===id(101));assert.equal(first.notas,'Conservar nota');assert.equal(first.ultimoRepaso,'2026-11-01');assert.equal(result.assignments.find(a=>a.id===id(500)).realizado,false);
  assert(f.calls.every(c=>c.url.includes('1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60')));assert(f.calls.filter(c=>c.method==='POST').every(c=>c.body.requests.every(r=>r.updateCells.range.sheetId===155111502)));
});
test('cargar sigue costando dos lecturas; un lote sin cambios no escribe',async()=>{
  const {f,run,data}=await seeded(1);await run({action:'validate'});assert.deepEqual(counts(f),{reads:2,writes:0});f.calls.length=0;
  const r=await run({action:'updateProgressBatch',updates:[{vinculoId:id(101),changes:{realizado:false}}],expectedVersion:data.version});assert(r.unchanged);assert.deepEqual(counts(f),{reads:2,writes:0});
});
test('lotes inválidos se rechazan antes de consultar Google',async()=>{
  const {f,run,data}=await seeded(1);const good={vinculoId:id(101),changes:{realizado:true}};
  for(const updates of [[],[good,good],[{...good,changes:{notas:'no permitido'}}],[{...good,changes:{realizado:'true'}}],[{...good,changes:{}}],Array.from({length:51},(_,i)=>({...good,vinculoId:id(i+1)}))])await assert.rejects(run({action:'updateProgressBatch',updates,expectedVersion:data.version}));
  assert.equal(f.calls.length,0);
});
test('una relación inexistente aborta todo el lote antes de escribir',async()=>{
  const {f,run,data}=await seeded(1);await assert.rejects(run({action:'updateProgressBatch',updates:[{vinculoId:id(101),changes:{realizado:true}},{vinculoId:id(999),changes:{repasando:true}}],expectedVersion:data.version}),{code:'NOT_FOUND'});assert.equal(counts(f).writes,0);
});
test('las relecturas agrupadas detectan edición externa antes de escribir',async()=>{
  const {f,run,data}=await seeded(1);let grids=0;f.onRead=()=>{if(new URL(f.calls.at(-1).url).searchParams.has('includeGridData')&&++grids===2)f.book.sheets[0].data[0].rowData[1].values[7]={userEnteredValue:{stringValue:'Edición externa'}};};
  await assert.rejects(run({action:'updateProgressBatch',updates:[{vinculoId:id(101),changes:{realizado:true}}],expectedVersion:data.version}),{code:'REVIEW_EXPIRED'});assert.equal(counts(f).writes,0);
});
for(const change of ['locale','rows','sheetId'])test('se verifica estructura fresca antes del lote: '+change,async()=>{
  const {f,run,data}=await seeded(1);let grids=0;f.onRead=()=>{if(new URL(f.calls.at(-1).url).searchParams.has('includeGridData')&&++grids===2){if(change==='locale')f.book.properties.locale='en_US';else if(change==='rows')f.book.sheets[0].properties.gridProperties.rowCount++;else f.book.sheets[1].properties.sheetId=777;}};
  await assert.rejects(run({action:'updateProgressBatch',updates:[{vinculoId:id(101),changes:{realizado:true}}],expectedVersion:data.version}));assert.equal(counts(f).writes,0);
});
test('la verificación posterior no da por guardado un resultado diferente',async()=>{
  const {f,run,data}=await seeded(1);f.afterWrite=()=>{f.book.sheets[1].data[0].rowData[1].values[4]={userEnteredValue:{boolValue:false}};};
  await assert.rejects(run({action:'updateProgressBatch',updates:[{vinculoId:id(101),changes:{realizado:true}}],expectedVersion:data.version}),{code:'WRITE_UNCERTAIN'});assert.deepEqual(counts(f),{reads:4,writes:1});
});
function clock(){let time=0,next=0;const timers=new Map();return {now:()=>time,schedule(fn,ms){timers.set(++next,{fn,at:time+ms});return next;},cancel(id){timers.delete(id);},async advance(ms){time+=ms;for(const[id,t]of [...timers])if(t.at<=time){timers.delete(id);await t.fn();}await new Promise(resolve=>setImmediate(resolve));},size:()=>timers.size};}
async function queueHarness(){const {f,run}=await seeded(2);const sent=[];let fail=null;const client=C.forProfile('production').create({writeEnabled:true,transport:async p=>{sent.push(p);if(fail&&p.action!=='validate')throw fail;return run(p);}});await client.load();const timer=clock();const queue=C.createProgressQueue({client,...timer});f.calls.length=0;sent.length=0;return {f,client,queue,timer,sent,setFailure:e=>{fail=e;}};}
test('la cola agrupa pulsaciones, refleja el último valor y solo confirma al releer',async()=>{
  const {f,queue,timer,sent,client}=await queueHarness();queue.set(id(101),{realizado:true});queue.set(id(101),{repasando:true});queue.set(id(102),{realizado:true});assert.equal(sent.length,0);assert.equal(queue.state().pending,2);
  await timer.advance(1200);assert.equal(sent.length,1);assert.equal(sent[0].updates.length,2);assert.equal(queue.state().pending,0);assert.equal(client.state().data.assignments[0].realizado,true);assert.deepEqual(counts(f),{reads:4,writes:1});
});
test('deshacer el marcado dentro de la ventana no consume cuota',async()=>{
  const {f,queue,timer}=await queueHarness();queue.set(id(101),{realizado:true});queue.set(id(101),{realizado:false});await timer.advance(5000);assert.equal(queue.state().pending,0);assert.deepEqual(counts(f),{reads:0,writes:0});
});
for(const code of ['REVIEW_EXPIRED','WRITE_UNCERTAIN'])test('conserva marcados tras '+code+' y no reenvía sin revisar',async()=>{
  const h=await queueHarness();h.setFailure(Object.assign(Error(code),{code,status:code==='WRITE_UNCERTAIN'?503:409}));h.queue.set(id(101),{realizado:true});await h.timer.advance(1200);assert.equal(h.sent.length,1);assert.equal(h.queue.state().pending,1);assert.equal(h.client.state().needsReload,true);
  await h.timer.advance(60000);assert.equal(h.sent.length,1);await assert.rejects(h.queue.flush());assert.equal(h.sent.length,1);
  h.setFailure(null);await h.client.load();h.queue.reviewed();assert(h.queue.state().paused);assert.equal(h.queue.changes(id(101)).realizado,true);await h.queue.flush();assert.equal(h.queue.state().pending,0);
});
test('cuota 429 conserva el lote y espera sin reintentos automáticos',async()=>{
  const h=await queueHarness();h.setFailure(Object.assign(Error('Quota exceeded'),{status:429}));h.queue.set(id(101),{realizado:true});await h.timer.advance(1200);assert.equal(h.sent.length,1);assert(h.queue.state().retryInMs>0);await assert.rejects(h.queue.flush());assert.equal(h.sent.length,1);await h.timer.advance(60000);assert.equal(h.sent.length,1);assert.equal(h.queue.state().retryInMs,0);assert.equal(h.queue.state().pending,1);
});
test('un envío cuyo resultado se perdió se reconcilia por lectura sin repetirlo',async()=>{
  const h=await queueHarness();h.f.failAfterWrite=true;h.queue.set(id(101),{realizado:true});await h.timer.advance(1200);assert.equal(h.queue.state().pending,1);assert.equal(counts(h.f).writes,1);h.f.failAfterWrite=false;await h.client.load();h.queue.reviewed();await h.queue.flush();assert.equal(counts(h.f).writes,1);assert.equal(h.queue.state().pending,0);
});
test('la ventana máxima guarda aunque continúen llegando pulsaciones',async()=>{
  const h=await queueHarness();h.queue.set(id(101),{realizado:true});for(let n=0;n<4;n++){await h.timer.advance(900);assert.equal(h.sent.length,0);h.queue.set(id(101),{repasando:true});}await h.timer.advance(400);assert.equal(h.sent.length,1);assert.equal(h.queue.state().pending,0);
});
test('más de cincuenta relaciones se dividen sin perder marcados',async()=>{
  const assignments=Array.from({length:51},(_,i)=>({id:id(i+1),realizado:false,repasando:false})),sent=[];
  const client={state:()=>({canWrite:true,data:{assignments}}),async save(p){sent.push(p);assert(p.updates.length<=50);for(const u of p.updates)Object.assign(assignments.find(a=>a.id===u.vinculoId),u.changes);}};
  const timer=clock(),q=C.createProgressQueue({client,...timer});for(const a of assignments)q.set(a.id,{realizado:true});await q.flush();assert.equal(q.state().pending,1);await q.flush();assert.equal(q.state().pending,0);assert.deepEqual(sent.map(p=>p.updates.length),[50,1]);assert(assignments.every(a=>a.realizado));
});
