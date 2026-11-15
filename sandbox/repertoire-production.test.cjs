'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('./repertoire-policy.cjs'), S = require('./repertoire-service.cjs'), C = require('../repertoire-client.js');
const { createHandler } = require('../api/repertorio-test.js');
const X = require('./repertoire-migration.cjs'), B = require('./repertoire-production-bootstrap.cjs');
const { fixture, theme, id } = require('./fixtures/repertoire.cjs');
function prod() {
  const f = fixture(); f.book.spreadsheetId = P.createPolicy('production').TARGET_ID;
  f.book.sheets[0].properties.sheetId = 155111501; f.book.sheets[1].properties.sheetId = 155111502;
  return f;
}
async function call(handler, body, method = 'POST', query = {}) {
  let result; const res = { setHeader(){}, status(n){this.code=n;return this;}, json(v){result={code:this.code||200,body:v};} };
  await handler({method,query,body,headers:{origin:'https://javat93.github.io',authorization:'Bearer simulated'}},res);return result;
}
test('producción y desarrollo no comparten destino, modo, IDs de pestaña ni sesión', async()=>{
  const f=prod(), h=createHandler({profile:'production',writeEnabled:true,origins:['https://javat93.github.io'],request:f.request});
  const e=await call(h,null,'GET',{api:'environment'});C.forProfile('production').verifyEnvironment(e.body);assert.throws(()=>C.verifyEnvironment(e.body));
  assert.equal(e.body.sessionKey,'horas-repertoire-production-token');assert.equal(e.body.calendarAccess,false);
  const initial=await call(h,{action:'validate'});assert.equal(initial.code,200);C.forProfile('production').verifyData(initial.body);
  const made=await call(h,{action:'saveTheme',theme:theme(),expectedVersion:initial.body.version});assert.equal(made.code,200);
  const rejected=await call(h,{action:'validate',spreadsheetId:P.DEVELOPMENT_ID});assert.equal(rejected.code,403);
  const bad=await call(h,{action:'deleteEvent'});assert.equal(bad.code,400);
  assert(f.calls.every(c=>c.url.includes(f.book.spreadsheetId)));assert(f.calls.filter(c=>c.method==='POST').every(c=>c.body.requests.every(r=>[155111501,155111502].includes(r.updateCells.range.sheetId))));
});
test('modo productivo de consulta bloquea cambios y no modifica el servicio heredado',async()=>{
  const f=prod(), h=createHandler({profile:'production',origins:['https://javat93.github.io'],request:f.request});const read=await call(h,{action:'validate'});
  assert.equal((await call(h,{action:'saveTheme',theme:theme(),expectedVersion:read.body.version})).code,403);assert(f.calls.every(c=>c.method==='GET'));
});
test('barrera productiva rechaza Detalle, Calendar, cabeceras, IDs de desarrollo y otro libro',async()=>{
  let calls=0;const p=P.createPolicy('production'), safe=p.guardRequest(async()=>{calls++;});
  for(const url of [P.BASE+'?fields=x','https://www.googleapis.com/calendar/v3/calendars/primary/events',p.BASE+'?includeGridData=true&ranges=Detalle!A1:A2'])await assert.rejects(safe(url,'x'));
  for(const sheetId of [0,758405382,142601101,142601102])await assert.rejects(safe(p.BASE+':batchUpdate','x','POST',{requests:[{updateCells:{range:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:8},rows:[{values:S.themeCells(theme())}],fields:'userEnteredValue,userEnteredFormat.numberFormat,dataValidation'}}]}));
  assert.equal(calls,0);
});
test('migración productiva conserva el seguimiento, no duplica y puede recuperar solo repertorio',async()=>{
  const source=fixture(),destination=prod();await source.seed();await source.apply({action:'updateProgress',vinculoId:id(101),changes:{realizado:true,repasando:true,ultimoRepaso:'2026-11-15',notas:'Conservar'}});
  const x=X.createMigration('production'),calls=[],request=(url,token,method='GET',body)=>{calls.push({url,method,body});return(url.includes(x.DESTINATION)?destination:source).request(url,token,method,body);};
  const plan=await x.prepare(request);assert.equal(plan.writes.length,2);assert.equal(plan.kind,'repertoire-production-v1');
  const applied=await x.apply(plan,request);assert.equal(applied.rowsChanged,2);const after=await x.read(x.DESTINATION,request);assert(after.assignments[0].realizado&&after.assignments[0].repasando);assert.equal(after.assignments[0].ultimoRepaso,'2026-11-15');
  assert.equal((await x.apply(plan,request)).unchanged,true);await assert.rejects(X.apply(plan,request),{code:'INVALID_PLAN'});
  await assert.rejects(x.prepare(request,null,{allowDemo:true}),{code:'DEMO_DATA'});assert.equal((await x.rollback(applied.receipt,request)).restored,true);
  assert(calls.filter(c=>c.method==='POST').every(c=>c.url.includes(x.DESTINATION)&&c.body.requests.every(r=>[155111501,155111502].includes(r.updateCells.range.sheetId))));
});
test('preparación nativa solo añade las dos hojas nuevas y no se repite sobre hojas existentes',()=>{
  const p=P.createPolicy('production'),meta={spreadsheetId:p.TARGET_ID,sheets:[{properties:{title:'Detalle',sheetId:0}},{properties:{title:'Coles',sheetId:758405382}}]};
  const plan=B.bootstrap(meta);assert.deepEqual(plan.requests.filter(r=>r.addSheet).map(r=>r.addSheet.properties.sheetId),[155111501,155111502]);
  const ids=[];function walk(v){if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k==='sheetId')ids.push(x);else walk(x);}}walk(plan.requests);assert(ids.every(n=>[155111501,155111502].includes(n)));
  assert.throws(()=>B.bootstrap({...meta,spreadsheetId:P.DEVELOPMENT_ID}));assert.throws(()=>B.bootstrap({...meta,sheets:[...meta.sheets,{properties:{title:'Temas',sheetId:155111501}}]}));
});
