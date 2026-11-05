const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const S=require('./daily-service.cjs'),D=require('../locale-data.js'),{TEST_ID}=require('./policy.cjs'),{fake,clone,c}=require('./fixtures/daily.cjs');
const event=(id,extra={})=>({id,summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-05T18:00:00+01:00'},end:{dateTime:'2026-11-05T19:00:00+01:00'},...extra});
const session=(id,extra={})=>S.rowFor({group:'Moli de finestrelles',date:'2026-11-05',start:'18:00',end:'19:00',price:99,total:110,district:'Barrio manual',address:'Dirección especial',gig:false,calendarId:id,...extra});
const run=(f,action,extra={})=>S.runDaily({spreadsheetId:TEST_ID,kind:'sync',input:{month:'2026-11'},action,...extra},'token',f.request,new Date('2026-11-10T12:00:00Z'));
const apply=(f,p,operationId=randomUUID())=>run(f,'apply',{expectedVersion:p.version,operationId});
test('sustituir un evento elimina la fila anterior y añade la nueva en un lote recuperable, incluso con igual horario',async()=>{
  const f=fake();f.grids.get(0).push(session('old'));const old=f.grids.get(0)[1];old[6]={userEnteredValue:{formulaValue:'=E2*H2'},note:'Importe especial'};old[14]=c('NO');const before=clone(old);
  f.setEvents([event('old',{status:'cancelled'}),event('replacement')]);
  const p=await run(f,'preview');assert.equal(p.removals.length,1);assert.equal(p.summary.length,1);assert.equal(p.moves.length,0);assert(!f.calls.some(c=>c.url.endsWith(':batchUpdate')));
  const id=randomUUID(),result=await apply(f,p,id);assert.equal(result.removed,1);assert.equal(result.added,1);assert(S.values(f.grids.get(0)[1]).every(v=>!Object.keys(v).length));assert.equal(D.value(f.grids.get(0)[2][10]),'replacement');
  const writes=f.calls.find(c=>c.url.endsWith(':batchUpdate')).body.requests;assert(writes.findIndex(r=>r.appendCells?.sheetId===0)<writes.findIndex(r=>r.updateCells));
  assert.equal((await apply(f,p,id)).alreadyApplied,true);assert.equal(f.grids.get(0).length,3);
  const trash=await S.runDaily({spreadsheetId:TEST_ID,action:'trash'},'token',f.request);assert.equal(trash.items.length,1);const restore={spreadsheetId:TEST_ID,kind:'restore',input:{operationId:trash.items[0].operationId},action:'preview'};
  const plan=await S.runDaily(restore,'token',f.request);await S.runDaily({...restore,action:'apply',expectedVersion:plan.version,operationId:randomUUID()},'token',f.request);assert.deepEqual(f.grids.get(0)[1],before);
  assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
});
test('mover un evento a otro mes actualiza la misma fila y conserva precio, barrio, pago y dirección',async()=>{
  const f=fake();f.grids.get(0).push(session('move'));f.grids.get(0)[1][0]=c('X');f.grids.get(0)[1][6]={userEnteredValue:{formulaValue:'=E2*H2'}};f.grids.get(0)[1][5].note='Fecha revisada';f.grids.get(0)[1][5].userEnteredFormat.backgroundColor={red:1};const before=clone(f.grids.get(0)[1]);
  const moved=event('move',{start:{dateTime:'2026-12-03T20:00:00+01:00'},end:{dateTime:'2026-12-03T21:30:00+01:00'}}),original=f.request;
  f.request=async(url,...args)=>url.includes('/events/move')?clone(moved):original(url,...args);
  const p=await run(f,'preview');assert.equal(p.removals.length,0);assert.equal(p.moves.length,1);assert.equal(p.moves[0].date,'2026-12-03');await apply(f,p);
  assert.equal(f.grids.get(0).length,2);assert.equal(D.value(f.grids.get(0)[1][5]),D.serial('2026-12-03'));assert.equal(D.time(D.value(f.grids.get(0)[1][12])),'20:00');
  for(let i=0;i<15;i++)if(![5,12,13].includes(i))assert.deepEqual(f.grids.get(0)[1][i],before[i]);
  assert.equal(f.grids.get(0)[1][5].note,'Fecha revisada');assert.deepEqual(f.grids.get(0)[1][5].userEnteredFormat.backgroundColor,{red:1});
  assert.equal((await run(f,'preview')).removals.length,0);
});
test('un evento traído de otro mes se encuentra por ID y no se duplica',async()=>{
  const f=fake();f.grids.get(0).push(session('incoming',{date:'2026-10-29'}));f.setEvents([event('incoming')]);const p=await run(f,'preview');assert.equal(p.summary.length,0);assert.equal(p.moves.length,1);await apply(f,p);assert.equal(f.grids.get(0).length,2);assert.equal(D.value(f.grids.get(0)[1][5]),D.serial('2026-11-05'));
});
test('404 y 410 retiran solo el vínculo comprobado; errores de permisos, cuota o servidor no escriben nada',async()=>{
  for(const status of [404,410,403,429,500]){
    const f=fake();f.grids.get(0).push(session('missing'));const original=f.request;f.request=async(url,...args)=>{if(url.includes('/events/missing'))throw Object.assign(Error('Google '+status),{status});return original(url,...args);};
    if([404,410].includes(status)){const p=await run(f,'preview');assert.equal(p.removals.length,1);await apply(f,p);assert(S.values(f.grids.get(0)[1]).every(v=>!Object.keys(v).length));}
    else{await assert.rejects(run(f,'preview'),/Google/);assert(!f.calls.some(c=>c.url.endsWith(':batchUpdate')));assert.equal(D.value(f.grids.get(0)[1][10]),'missing');}
  }
});
test('las filas manuales, partidas compartidas y eventos que cambiaron de color o grupo se conservan',async()=>{
  const f=fake();f.grids.get(0).push(session(''),session('shared'),session('shared',{total:5}),session('personal'),session('renamed'));
  f.setEvents([event('personal',{colorId:'1'}),event('renamed',{summary:'Otro grupo'})]);const before=clone(f.grids.get(0));const p=await run(f,'preview');assert.equal(p.removals.length,0);assert.equal(p.moves.length,0);assert.equal(p.summary.length,0);assert.equal((await apply(f,p)).unchanged,true);assert.deepEqual(f.grids.get(0),before);
});
test('la reaparición del evento o una edición manual invalida el borrado antes de guardar',async()=>{
  for(const change of ['calendar','sheet']){
    const f=fake();f.grids.get(0).push(session('back'));const p=await run(f,'preview');assert.equal(p.removals.length,1);
    if(change==='calendar')f.setEvents([event('back')]);else f.grids.get(0)[1][9]=c('Edición posterior');
    await assert.rejects(apply(f,p),/cambió/);assert(!f.calls.some(c=>c.url.endsWith(':batchUpdate')));
  }
});
test('la recuperación tras un timeout no repite ni el alta ni la baja',async()=>{
  const f=fake();f.grids.get(0).push(session('old'));f.setEvents([event('new')]);const p=await run(f,'preview'),id=randomUUID();f.timeout();await assert.rejects(apply(f,p,id),/incierto/);assert.equal((await apply(f,p,id)).alreadyApplied,true);assert.equal(f.grids.get(0).length,3);assert.equal((await S.runDaily({spreadsheetId:TEST_ID,action:'trash'},'token',f.request)).items.length,1);
});
test('no se cambia una fecha si colisiona con otra partida o depende de una fórmula especial',async()=>{
  for(const mode of ['duplicate','formula']){
    const f=fake();f.grids.get(0).push(session('move',{date:'2026-11-04'}));if(mode==='duplicate')f.grids.get(0).push(session('',{date:'2026-11-05'}));else f.grids.get(0)[1][6]={userEnteredValue:{formulaValue:'=(N2-M2)*24*E2'}};
    f.setEvents([event('move')]);const p=await run(f,'preview');assert.equal(p.moves.length,0);assert.equal(p.summary.length,0);assert.equal(p.removals.length,0);assert(p.skipped.some(s=>/partida|Fórmula/.test(s.reason)));
  }
});
