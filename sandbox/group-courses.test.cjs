'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const C = require('../group-courses.js'), G = require('../group-identity.js'), { fixture } = require('./fixtures/group-courses.cjs');
const curso = '2026–2027', update = (grupo, activo = true, tipo = 'habitual') => ({ grupo, activo, tipo });
test('curso escolar de Madrid cambia en septiembre, no en enero', () => {
  assert.equal(C.currentCourse(new Date('2026-08-31T21:59:59Z')), '2025–2026');
  assert.equal(C.currentCourse(new Date('2026-08-31T22:00:00Z')), curso);
  assert.equal(C.currentCourse(new Date('2027-01-01T00:00:00Z')), curso);
  assert.equal(C.previous(curso), '2025–2026');
  for (const v of ['2026', '2026–2028', '2026-2027']) assert.throws(() => C.course(v));
});
test('sin clasificar no equivale a inactivo; filtros y alias conservan orden alfabético', async () => {
  const f = fixture(); let d = await f.read(); assert.equal(d.records.length, 0);
  assert.equal(C.filter(d.groups, d.records, { curso, estado: 'active', tipo: 'habitual' }).length, 0);
  assert.equal(C.filter(d.groups, d.records, { curso, estado: 'unclassified', tipo: 'all' }).length, 3);
  d = await f.save(curso, [update('Slap Lunes'), update('La Maquinista', true, 'puntual')]);
  assert.deepEqual(C.filter(d.groups, d.records, { curso, estado: 'active', tipo: 'all' }).map(g => g.nombre), ['La Maquinista', 'Slap Lunes']);
  assert.equal(C.filter(d.groups, d.records, { curso, estado: 'inactive', tipo: 'all' }).length, 0);
  assert.equal(C.filter(d.groups, d.records, { curso, estado: 'active', tipo: 'puntual' })[0].nombre, 'La Maquinista');
});
test('cien grupos se guardan en un lote con cuatro lecturas, sin acceder a sesiones ni repertorio', async () => {
  const groups = Array.from({ length: 100 }, (_, i) => 'Grupo ' + i), f = fixture({ groups, rowCount: 120 });
  const originalValues = () => JSON.stringify(f.book.sheets.slice(0, 3).map(s => ({ properties: s.properties, rows: s.data[0].rowData.map(r => r.values.map(c => c.userEnteredValue || {})) })));
  const before = originalValues(), version = (await f.read()).version; f.calls.length = 0;
  const d = await f.run({ action: 'save', curso, updates: groups.map(g => update(g)), expectedVersion: version });
  assert.equal(d.records.length, 100); assert.equal(f.calls.filter(c => c.method === 'GET').length, 4);
  const writes = f.calls.filter(c => c.method === 'POST'); assert.equal(writes.length, 1); assert.equal(writes[0].body.requests.length, 100);
  assert.equal(originalValues(), before);
  for (const c of f.calls) { assert.ok(!c.url.includes('calendar')); for (const range of new URL(c.url).searchParams.getAll('ranges')) assert.match(range, /^(Coles!A1:A|GruposCurso!A1:F)\d+$/); }
  assert.ok(writes[0].body.requests.every(r => r.updateCells.range.sheetId === C.SHEET_ID && r.updateCells.fields === 'userEnteredValue'));
});
test('inactivar conserva el curso anterior; copiar no sobrescribe clasificados ni cambia el origen', async () => {
  const f = fixture(); await f.save('2025–2026', [update('Slap Lunes'), update('La Maquinista', false, 'puntual')]);
  let d = await f.save(curso, [update('Slap Lunes', false)]);
  const before = JSON.stringify(d.records); const copies = C.copyPrevious(d.groups, d.records, curso);
  assert.deepEqual(copies, [update('La Maquinista', false, 'puntual')]); assert.equal(JSON.stringify(d.records), before);
  d = await f.save(curso, copies); assert.equal(d.records.length, 4);
  assert.equal(C.classification(d.records, 'Slap Lunes', '2025–2026').activo, true);
  assert.equal(C.classification(d.records, 'Slap Lunes', curso).activo, false);
});
test('carga son dos lecturas; repetir un guardado confirmado no vuelve a escribir', async () => {
  const f = fixture(); await f.read(); assert.equal(f.calls.length, 2);
  await f.save(curso, [update('Slap Lunes')]); const d = await f.read(); f.calls.length = 0;
  const result = await f.run({ action: 'save', curso, updates: [update('Slap Lunes')], expectedVersion: d.version });
  assert.equal(result.rowsChanged, 0); assert.equal(f.calls.length, 2);
});
test('rechaza payloads manipulados antes de Google y grupos inexistentes antes de escribir', async () => {
  const f = fixture(), version = 'a'.repeat(64);
  for (const p of [ { action: 'save', curso, updates: [update('Slap Lunes', 'true')], expectedVersion: version }, { action: 'save', curso, updates: [update('Slap Lunes'), update(' slap lunes ')], expectedVersion: version }, { action: 'load', spreadsheetId: 'otro' }, { action: 'save', curso, updates: Array.from({length:101}, (_,i)=>update('Grupo '+i)), expectedVersion: version }, { action: 'save', curso, updates: [{...update('Slap Lunes'), notas:'x'}], expectedVersion:version } ]) await assert.rejects(f.run(p));
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.save(curso, [update('No existe')])); assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
});
test('alias de grupo mantiene identidad y nombre canónico', async () => {
  const f = fixture({ groups: ['Moli de finestrelles'] }); const d = await f.save(curso, [update('Tramuntana')]);
  assert.equal(d.records[0].id, G.id('Tramuntana')); assert.equal(d.records[0].grupo, 'Moli de finestrelles');
});
test('edición externa antes de guardar bloquea todo el lote sin escritura', async () => {
  const f = fixture(), d = await f.read(); let reads = 0;
  f.onRead = () => { if (++reads === 3) f.book.sheets.find(s => s.properties.title === 'Coles').data[0].rowData[3].values[0].userEnteredValue.stringValue = 'Grupo modificado'; };
  await assert.rejects(f.run({ action: 'save', curso, updates: [update('Slap Lunes')], expectedVersion: d.version }), { code: 'REVIEW_EXPIRED' });
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
});
test('cambio de estructura y cabeceras se detiene antes de escribir', async () => {
  for (const mutate of [s => s.properties.sheetId++, s => s.properties.gridProperties.rowCount++, s => s.data[0].rowData[0].values[0].userEnteredValue.stringValue = 'Otra cabecera']) {
    const f = fixture(), d = await f.read(); let reads = 0; f.onRead = () => { if (++reads === 3) mutate(f.book.sheets.find(s=>s.properties.title==='GruposCurso')); };
    await assert.rejects(f.run({action:'save',curso,updates:[update('Slap Lunes')],expectedVersion:d.version})); assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  }
});
test('respuesta perdida se reconcilia leyendo y no repite la escritura aplicada', async () => {
  const f = fixture(), d = await f.read(); f.failAfterWrite = true;
  await assert.rejects(f.run({action:'save',curso,updates:[update('Slap Lunes')],expectedVersion:d.version}), {code:'WRITE_UNCERTAIN'});
  f.failAfterWrite = false; const fresh = await f.read(); f.calls.length = 0;
  await f.run({action:'save',curso,updates:[update('Slap Lunes')],expectedVersion:fresh.version});
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
});
test('relectura incorrecta nunca se presenta como guardado verificado', async () => {
  const f = fixture(), d = await f.read(); f.afterWrite = () => { f.book.sheets.find(s=>s.properties.title==='GruposCurso').data[0].rowData[1].values[4].userEnteredValue.stringValue = 'puntual'; };
  await assert.rejects(f.run({action:'save',curso,updates:[update('Slap Lunes')],expectedVersion:d.version}), {code:'WRITE_UNCERTAIN'});
});
test('cuota agotada durante verificación conserva la señal 429 y no repite escrituras', async () => {
  const f = fixture(), d = await f.read(); let written = false;
  const request = async (...args) => { if (written && args[2] !== 'POST') throw Object.assign(Error('Quota exceeded'), {status:429}); const result = await f.request(...args); if (args[2] === 'POST') written = true; return result; };
  await assert.rejects(f.service.run({action:'save',curso,updates:[update('Slap Lunes')],expectedVersion:d.version},'Bearer synthetic',request), {code:'WRITE_UNCERTAIN',status:429});
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('cliente comparte carga en curso y caché entre vistas; filtrar y copiar no hace lecturas', async () => {
  const f = fixture(); let requests = 0, environments = 0;
  const store = C.createStore({ transport: p => { requests++; return f.run(p); }, environment: async()=>{environments++;return {mode:'group-courses-production',spreadsheetId:C.TARGET,sheetId:C.SHEET_ID,calendarAccess:false,writeEnabled:true,writableSheets:['GruposCurso']};} });
  await Promise.all([store.load(),store.load(),store.load()]); await store.load(); assert.equal(requests,1); assert.equal(environments,1);
  for(let i=0;i<30;i++) C.filter(store.state().data.groups,[],{curso,estado:'all',tipo:'all'}); C.copyPrevious(store.state().data.groups,[],curso); assert.equal(requests,1);
});
test('cliente conserva datos y exige revisión manual tras conflicto, cuota o respuesta incierta', async () => {
  for (const error of [{code:'REVIEW_EXPIRED',status:409},{status:429},{code:'WRITE_UNCERTAIN',status:503}]) {
    const f = fixture(); let failSave = false, calls = 0;
    const store = C.createStore({ environment:async()=>({mode:'group-courses-production',spreadsheetId:C.TARGET,sheetId:C.SHEET_ID,calendarAccess:false,writeEnabled:true,writableSheets:['GruposCurso']}), transport:p=>{calls++;if(failSave&&p.action==='save')throw Object.assign(Error('fallo'),error);return f.run(p);} });
    await store.load(); const before=store.state().data; failSave=true;
    await assert.rejects(store.save(curso,[update('Slap Lunes')])); assert.equal(store.state().needsReload,true); assert.equal(store.state().data,before); assert.equal(calls,2);
    await assert.rejects(store.save(curso,[update('Slap Lunes')])); assert.equal(calls,2);
    failSave=false;await store.load(true);assert.equal(store.state().canWrite,true);
  }
});
test('API entorno sin lecturas, autenticación y CORS sin ampliar destinos', async () => {
  const {createHandler}=require('../api/grupos-curso.js');let calls=0;const handler=createHandler({request:async()=>{calls++;throw Error('no debe llamar');}});
  async function run(req){let status=200,data;const res={setHeader(){},status(n){status=n;return this;},json(d){data=d;return this;},end(){}};await handler({headers:{},query:{},...req},res);return{status,data};}
  assert.equal((await run({method:'GET',query:{api:'environment'}})).data.sheetId,C.SHEET_ID);
  assert.equal((await run({method:'POST',body:{action:'load'}})).status,401);
  assert.equal((await run({method:'POST',headers:{origin:'https://evil.test',authorization:'Bearer x'},body:{action:'load'}})).status,403);
  assert.equal((await run({method:'POST',headers:{authorization:'Bearer x'},body:{action:'load',range:'Detalle!A1'}})).status,400);
  assert.equal(calls,0);
});
