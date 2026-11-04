const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const S=require('./daily-service.cjs'),D=require('../locale-data.js'),{TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const {fake,clone,c}=require('./fixtures/daily.cjs');
const input={group:'Tramuntana',date:'2026-11-05',start:'18:00',end:'19:15',price:'33,75',total:'40,25',district:'Barrio especial',address:'Dirección especial',gig:true};
const payload=(kind,input,rest={})=>({spreadsheetId:TEST_ID,kind,input,...rest});
const preview=(f,kind,input)=>S.runDaily(payload(kind,input,{action:'preview'}),'token',f.request,new Date('2026-11-02T12:00:00Z'));
const apply=(f,kind,input,p,extra={})=>S.runDaily(payload(kind,input,{action:'apply',expectedVersion:p.version,operationId:randomUUID(),...extra}),'token',f.request,new Date('2026-11-02T12:00:00Z'));
test('alta nativa conserva precio especial, total independiente, barrio y H=1; Calendar no escribe',async()=>{
  const f=fake(),p=await preview(f,'session',input);assert.equal(f.calls.filter(c=>c.url.endsWith(':batchUpdate')).length,0);
  const r=await apply(f,'session',input,p),row=f.grids.get(0)[1];assert.equal(r.saved,1);assert.equal(D.value(row[4]),33.75);assert.equal(D.value(row[6]),40.25);assert.equal(D.value(row[7]),1);assert.equal(D.value(row[8]),'Moli de finestrelles');assert.equal(D.value(row[9]),'Barrio especial');assert.equal(D.value(row[11]),'Dirección especial');assert.equal(D.value(row[5]),D.serial(input.date));assert.equal(row[5].userEnteredFormat.numberFormat.pattern,'dd/mm/yyyy');
});
test('altas de grupo no duplican alias y permiten tarifas vacías sin inventarlas',async()=>{
  const f=fake();await assert.rejects(preview(f,'group',{name:'Tramuntana'}),/ya existe/);
  const v={name:'Nuevo grupo',price:'',gigPrice:'0',district:'Zona',address:'Calle'},p=await preview(f,'group',v);await apply(f,'group',v,p);const row=f.grids.get(758405382)[2];assert.equal(D.value(row[2]),'');assert.equal(D.value(row[3]),0);assert.equal(D.value(row[4]),'Zona');
});
test('repeticiones calculan desde la fecha original y omiten el 31 inexistente; límites y fechas imposibles',()=>{
  assert.deepEqual(S.dates('2026-01-31',{frequency:'MONTHLY',interval:1,until:'2026-05-31'}),['2026-01-31','2026-03-31','2026-05-31']);
  assert.deepEqual(S.dates('2026-03-22',{frequency:'WEEKLY',interval:1,until:'2026-04-05'}),['2026-03-22','2026-03-29','2026-04-05']);
  assert.throws(()=>S.dates('2026-01-01',{frequency:'DAILY',interval:1,until:'2026-12-31'}),/100 sesiones/);
  assert.throws(()=>S.session({...input,date:'2026-02-30'},[{nombre:'Tramuntana'}]),/Fecha/);
});
test('rechaza original, campos adicionales, importes ambiguos y horarios inseguros sin escribir',async()=>{
  const f=fake();await assert.rejects(S.runDaily({...payload('session',input),spreadsheetId:ORIGINAL_ID,action:'preview'},'',f.request),/bloqueado/);assert.equal(f.calls.length,0);
  for(const bad of [{...input,price:'1,2,3'},{...input,start:'23:30',end:'00:30'},{...input,calendarId:'personal'},{...input,group:'No existe'}])await assert.rejects(preview(f,'session',bad));assert.equal(f.calls.filter(c=>c.url.endsWith(':batchUpdate')).length,0);
});
test('una edición posterior invalida la revisión; partidas similares exigen consentimiento y se conservan',async()=>{
  const f=fake(),p=await preview(f,'session',input);f.grids.get(758405382)[1][4]=c('Barrio manual');await assert.rejects(apply(f,'session',input,p),/cambió/);
  const current=await preview(f,'session',input);await apply(f,'session',input,current);const duplicate=await preview(f,'session',input);assert.equal(duplicate.duplicates,1);await assert.rejects(apply(f,'session',input,duplicate),/partida adicional/);await apply(f,'session',input,duplicate,{allowSimilar:true});assert.equal(f.grids.get(0).length,3);
});
test('timeout tras guardar se consulta con el mismo identificador y no duplica el alta',async()=>{
  const f=fake(),p=await preview(f,'session',input),id=randomUUID(),request=payload('session',input,{action:'apply',expectedVersion:p.version,operationId:id});f.timeout();await assert.rejects(S.runDaily(request,'token',f.request),/incierto/);const r=await S.runDaily(request,'token',f.request);assert.equal(r.alreadyApplied,true);assert.equal(f.grids.get(0).length,2);await assert.rejects(S.runDaily({...request,input:{...input,price:9}},'token',f.request),/otra revisión/);
});
test('papelera y restauración conservan fórmula, formato, nota y excepción; no desplazan filas ni borran Calendar',async()=>{
  const f=fake();f.grids.get(0).push(S.rowFor({...input,group:'Moli de finestrelles',price:20,total:20,calendarId:'shared'}));
  const row=f.grids.get(0)[1];row[6]={userEnteredValue:{formulaValue:'=E2*H2'},userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'0.00'}},note:'importe especial'};row[14]=c('NO');const before=clone(row);
  const p=await preview(f,'delete',{rowIdx:2}),r=await apply(f,'delete',{rowIdx:2},p);assert.equal(r.archived,true);assert.equal(f.grids.get(0).length,2);assert(S.values(f.grids.get(0)[1]).every(v=>!Object.keys(v).length));
  const trash=await S.runDaily({spreadsheetId:TEST_ID,action:'trash'},'token',f.request);assert.equal(trash.items.length,1);
  const restoreInput={operationId:r.operationId},restore=await preview(f,'restore',restoreInput);await apply(f,'restore',restoreInput,restore);assert.deepEqual(f.grids.get(0)[1],before);assert.equal((await S.runDaily({spreadsheetId:TEST_ID,action:'trash'},'token',f.request)).items.length,0);
  assert(!f.calls.some(c=>c.url.startsWith('https://www.googleapis.com/calendar')&&c.method!=='GET'));
});
test('restaurar no sobrescribe una fila ocupada ni un archivo manipulado',async()=>{
  const f=fake();f.grids.get(0).push(S.rowFor({...input,group:'Moli de finestrelles',price:20,total:20}));const p=await preview(f,'delete',{rowIdx:2}),r=await apply(f,'delete',{rowIdx:2},p);
  f.grids.get(0)[1][0]=c('nuevo dato');await assert.rejects(preview(f,'restore',{operationId:r.operationId}),/datos nuevos/);
  const trash=[...f.props.values()].find(p=>p.title===S.TRASH);f.grids.get(trash.sheetId)[0][3]=c('[]');await assert.rejects(S.runDaily({spreadsheetId:TEST_ID,action:'trash'},'token',f.request),/no coincide/);
});
const event=(id,extra={})=>({id,summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-05T18:00:00+01:00'},end:{dateTime:'2026-11-05T19:00:00+01:00'},location:'Lugar de Calendar',...extra});
test('importación lee todas las páginas y omite personales, cancelados, duplicados y grupos ambiguos',async()=>{
  const f=fake();f.setEvents([event('work'),event('personal',{colorId:'1'}),event('cancel',{status:'cancelled'}),event('unknown',{summary:'No existe'}),event('all-day',{start:{date:'2026-11-05'},end:{date:'2026-11-06'}})],[event('duplicate')]);
  const p=await preview(f,'import',{month:'2026-11'});assert.equal(p.summary.length,1);assert.equal(p.summary[0].price,24);assert.equal(p.summary[0].address,'Lugar de Calendar');assert.equal(p.summary[0].district,'Barrio catálogo');assert(p.skipped.some(s=>/mismo grupo/.test(s.reason)));await apply(f,'import',{month:'2026-11'},p);assert.equal(D.value(f.grids.get(0)[1][10]),'work');
  const next=await preview(f,'import',{month:'2026-11'});assert.equal(next.summary.length,0);assert(f.calls.filter(c=>c.url.startsWith('https://www.googleapis.com/calendar')).every(c=>c.method==='GET'));
});
test('importación respeta sesión manual sin CalendarId y bloquea propuesta si cambia el evento',async()=>{
  const f=fake();f.setEvents([event('work')]);const p=await preview(f,'import',{month:'2026-11'});f.setEvents([event('work',{location:'otro lugar'})]);await assert.rejects(apply(f,'import',{month:'2026-11'},p),/cambió/);
  f.grids.get(0).push(S.rowFor({...input,group:'Moli de finestrelles',start:'18:00',end:'19:00',price:100,total:100,district:'Barrio manual'}));const skipped=await preview(f,'import',{month:'2026-11'});assert.equal(skipped.summary.length,0);assert.equal(D.value(f.grids.get(0)[1][4]),100);assert.equal(D.value(f.grids.get(0)[1][9]),'Barrio manual');
});
test('sincronización incluye eventos nuevos pasados del mes sin cambiar las sesiones existentes',async()=>{
  const f=fake();f.setEvents([event('past',{start:{dateTime:'2026-11-01T18:00:00+01:00'},end:{dateTime:'2026-11-01T19:00:00+01:00'}})]);
  f.grids.get(0).push(S.rowFor({...input,group:'Moli de finestrelles',price:99,total:100,district:'Barrio manual'}));const before=clone(f.grids.get(0)[1]);
  assert.equal((await preview(f,'import',{month:'2026-11'})).summary.length,0);
  const options={month:'2026-11',includePast:true},plan=await preview(f,'import',options);assert.equal(plan.summary.length,1);assert.equal(plan.summary[0].calendarId,'past');
  await apply(f,'import',options,plan);assert.deepEqual(f.grids.get(0)[1],before);assert.equal(D.value(f.grids.get(0)[2][10]),'past');
  assert.equal((await preview(f,'import',options)).summary.length,0);
  await assert.rejects(preview(f,'import',{month:'2026-11',includePast:'sí'}),/mes válido/);
});
