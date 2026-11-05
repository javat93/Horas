const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const C=require('./calendar-crud.cjs'),S=require('./daily-service.cjs'),D=require('../locale-data.js'),L=require('../calendar-linking.js'),P=require('./policy.cjs'),{fake,clone,c}=require('./fixtures/daily.cjs');
const input={group:'Tramuntana',date:'2026-11-05',start:'18:00',end:'19:15',price:'33,75',total:'40,25',district:'Barrio manual',address:'Dirección especial',gig:true,calendar:true};
const event=(id,extra={})=>({id,etag:'original',summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-05T18:00:00+01:00'},end:{dateTime:'2026-11-05T19:15:00+01:00'},location:'Dirección especial',...extra});
const row=(id,extra={})=>S.rowFor({...input,group:'Moli de finestrelles',price:33.75,total:40.25,calendarId:id,...extra});
const payload=(kind,input,extra={})=>({spreadsheetId:P.TEST_ID,kind,input,operationId:randomUUID(),...extra});
const preview=(f,p)=>C.runCalendarCrud({...p,action:'preview'},'synthetic-token',f.request);
const apply=(f,p,plan)=>C.runCalendarCrud({...p,action:'apply',expectedVersion:plan.version},'synthetic-token',f.request);
const pending=f=>C.runCalendarCrud({spreadsheetId:P.TEST_ID,action:'pending'},'synthetic-token',f.request);
test('alta crea evento amarillo con horario de Madrid y guarda su ID, importe independiente y barrio en la hoja',async()=>{
  const f=fake({calendarWrites:true}),p=payload('session',input),plan=await preview(f,p);assert.deepEqual(plan.calendarActions,['create']);assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
  const r=await apply(f,p,plan);assert.equal(r.calendarModified,true);const saved=f.grids.get(0)[1],id=D.value(saved[10]);assert(id.startsWith('horas'));assert.equal(D.value(saved[4]),33.75);assert.equal(D.value(saved[6]),40.25);assert.equal(D.value(saved[7]),1);assert.equal(D.value(saved[9]),'Barrio manual');
  const calendar=(await f.request('https://www.googleapis.com/calendar/v3/calendars/primary/events/'+id,'token'));assert.equal(calendar.summary,'Bolo Tramuntana');assert.equal(calendar.colorId,'5');assert.equal(calendar.location,input.address);assert.deepEqual(L.hours(calendar),{horaInicio:'18:00',horaFin:'19:15'});assert.equal(L.calendarDate(calendar),input.date);
  assert.equal((await apply(f,p,plan)).alreadyApplied,true);assert.equal(f.grids.get(0).length,2);assert.equal((await pending(f)).items.length,0);
});
test('partida solo en Excel no crea eventos; repeticiones crean eventos distintos y se guardan sin duplicarse',async()=>{
  const manual=fake({calendarWrites:true}),a=payload('session',{...input,calendar:false,start:'',end:''});await apply(manual,a,await preview(manual,a));assert.equal(D.value(manual.grids.get(0)[1][10]),'');assert(!manual.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
  const f=fake({calendarWrites:true}),p=payload('session',{...input,repeat:{frequency:'WEEKLY',interval:1,until:'2026-11-19'}}),plan=await preview(f,p);assert.equal(plan.summary.length,3);await apply(f,p,plan);assert.equal(new Set(f.grids.get(0).slice(1).map(r=>D.value(r[10]))).size,3);
});
test('editar modifica únicamente el evento vinculado y mantiene pago, barrio, importes y campos ajenos de Calendar',async()=>{
  const f=fake({calendarWrites:true});f.grids.get(0).push(row('work'));f.grids.get(0)[1][0]=c('X');f.setEvents([event('work',{summary:'Bolo Tramuntana',description:'Texto que se conserva',attendees:[{email:'example@example.invalid'}]})]);
  const p=payload('edit',{...input,rowIdx:2,date:'2026-12-07',start:'20:00',end:'21:00',address:'Otra calle'}),plan=await preview(f,p);assert.deepEqual(plan.calendarActions,['patch']);await apply(f,p,plan);
  const e=await f.request('https://www.googleapis.com/calendar/v3/calendars/primary/events/work','token');assert.equal(L.calendarDate(e),'2026-12-07');assert.equal(L.hours(e).horaInicio,'20:00');assert.equal(e.location,'Otra calle');assert.equal(e.description,'Texto que se conserva');assert.deepEqual(e.attendees,[{email:'example@example.invalid'}]);assert.equal(D.value(f.grids.get(0)[1][0]),'X');assert.equal(D.value(f.grids.get(0)[1][6]),40.25);assert.equal(D.value(f.grids.get(0)[1][9]),'Barrio manual');assert.equal(f.grids.get(0).length,2);
});
test('borrar retira el evento y archiva la fila; restaurar recupera sus datos y crea un vínculo nuevo válido',async()=>{
  const f=fake({calendarWrites:true});f.grids.get(0).push(row('work'));f.grids.get(0)[1][6].note='Caso especial';f.setEvents([event('work',{summary:'Bolo Tramuntana'})]);const before=clone(f.grids.get(0)[1]);
  const p=payload('delete',{rowIdx:2}),plan=await preview(f,p);assert.deepEqual(plan.calendarActions,['delete']);await apply(f,p,plan);assert.equal((await f.request('https://www.googleapis.com/calendar/v3/calendars/primary/events/work','token')).status,'cancelled');assert(S.values(f.grids.get(0)[1]).every(v=>!Object.keys(v).length));
  const restore=payload('restore',{operationId:p.operationId}),restored=await preview(f,restore);assert.deepEqual(restored.calendarActions,['create']);await apply(f,restore,restored);const after=f.grids.get(0)[1];for(let i=0;i<15;i++)if(i!==10)assert.deepEqual(after[i],before[i]);assert.notEqual(D.value(after[10]),'work');assert.equal((await f.request('https://www.googleapis.com/calendar/v3/calendars/primary/events/'+D.value(after[10]),'token')).status,'confirmed');
});
test('un vínculo compartido solo retira la partida; nunca borra el evento ni otra fila',async()=>{
  const f=fake({calendarWrites:true});f.grids.get(0).push(row('shared'),row('shared',{total:5}));f.setEvents([event('shared')]);const before=clone(f.grids.get(0)[2]),p=payload('delete',{rowIdx:2}),plan=await preview(f,p);assert.deepEqual(plan.calendarActions,[]);assert(plan.warnings.length);await apply(f,p,plan);assert.deepEqual(f.grids.get(0)[2],before);assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
});
test('un evento personal, de otro grupo o una serie completa no se edita ni se elimina',async()=>{
  for(const extra of [{colorId:'1'},{summary:'Personal'},{recurrence:['RRULE:FREQ=WEEKLY']}]){
    const f=fake({calendarWrites:true});f.grids.get(0).push(row('unsafe'));f.setEvents([event('unsafe',extra)]);await assert.rejects(preview(f,payload('delete',{rowIdx:2})),/vínculo|enlace/i);assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
  }
});
test('si Calendar cambia o la hoja se edita después de la revisión, se rechaza antes de escribir eventos',async()=>{
  for(const mode of ['sheet','calendar']){
    const f=fake({calendarWrites:true});f.grids.get(0).push(row('work'));f.setEvents([event('work',{summary:'Bolo Tramuntana'})]);const p=payload('edit',{...input,rowIdx:2,address:'Nueva dirección'}),plan=await preview(f,p);
    if(mode==='sheet')f.grids.get(0)[1][9]=c('Edición manual posterior');else f.setEvents([event('work',{summary:'Bolo Tramuntana',location:'Otro cambio'})]);
    await assert.rejects(apply(f,p,plan),/cambió|coincide/);assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
  }
});
test('timeout después de crear Calendar se comprueba por el ID y no duplica eventos',async()=>{
  const f=fake({calendarWrites:true}),original=f.request;let failed=false;f.request=async(url,token,method,body,headers)=>{const r=await original(url,token,method,body,headers);if(!failed&&url.includes('/calendar/')&&method==='POST'){failed=true;throw Error('Timeout después de guardar');}return r;};
  const p=payload('session',input),plan=await preview(f,p);await apply(f,p,plan);assert.equal(f.calls.filter(c=>c.url.includes('/calendar/')&&c.method==='POST').length,1);assert.equal(f.grids.get(0).length,2);
});
test('si Calendar guarda y Sheets falla, la operación queda recuperable tras recargar y no repite el evento',async()=>{
  const f=fake({calendarWrites:true}),original=f.request;let failed=false;f.request=async(url,token,method,body,headers)=>{if(!failed&&body?.requests?.some(r=>r.createDeveloperMetadata?.developerMetadata.metadataKey.startsWith('horas_calendar_done_'))){failed=true;throw Error('Sheets temporalmente no disponible');}return original(url,token,method,body,headers);};
  const p=payload('session',input),plan=await preview(f,p);await assert.rejects(apply(f,p,plan),/Sheets/);assert.equal(f.grids.get(0).length,1);assert.equal((await pending(f)).items.length,1);
  await C.runCalendarCrud({spreadsheetId:P.TEST_ID,action:'resume',operationId:p.operationId},'token',f.request);assert.equal(f.grids.get(0).length,2);assert.equal(f.calls.filter(c=>c.url.includes('/calendar/')&&c.method==='POST').length,1);assert.equal((await pending(f)).items.length,0);
});
test('permiso insuficiente no guarda una sesión huérfana; puede continuar tras concederlo',async()=>{
  const f=fake({calendarWrites:true}),original=f.request;let granted=false;f.request=async(url,token,method,body,headers)=>{if(url.includes('/calendar/')&&method==='POST'&&!granted)throw Object.assign(Error('Permiso de Calendar insuficiente'),{status:403});return original(url,token,method,body,headers);};
  const p=payload('session',input),plan=await preview(f,p);await assert.rejects(apply(f,p,plan),/Permiso/);assert.equal(f.grids.get(0).length,1);granted=true;await apply(f,p,plan);assert.equal(f.grids.get(0).length,2);
});
test('horarios de verano e invierno son de Madrid y se rechaza la hora inexistente del cambio horario',()=>{
  for(const date of ['2026-01-05','2026-07-05','2026-10-25']){const e=C.resource({...input,date});assert.equal(L.calendarDate(e),date);assert.deepEqual(L.hours(e),{horaInicio:'18:00',horaFin:'19:15'});}
  assert.throws(()=>C.resource({...input,date:'2026-03-29',start:'02:30',end:'03:30'}),/no existe/);
});
test('destino incorrecto, campos manipulados, otro identificador y diario alterado se rechazan',async()=>{
  const f=fake({calendarWrites:true});await assert.rejects(C.runCalendarCrud({...payload('session',input),spreadsheetId:P.ORIGINAL_ID,action:'preview'},'token',f.request),/bloqueado/);assert.equal(f.calls.length,0);
  await assert.rejects(preview(f,payload('session',{...input,calendarId:'personal'})),/Campos/);
  const p=payload('session',input),plan=await preview(f,p);await apply(f,p,plan);await assert.rejects(apply(f,{...p,input:{...input,price:10}},plan),/otra revisión/);
  const journal=[...f.props.values()].find(p=>p.title===C.JOURNAL);f.grids.get(journal.sheetId)[0][2]=c('{}');await assert.rejects(apply(f,p,plan),/registro/i);
});
test('una sincronización intermedia no incorpora ni retira un evento que tiene una operación pendiente',async()=>{
  for(const kind of ['session','delete']){
    const f=fake({calendarWrites:true}),original=f.request;let failed=false;f.request=async(url,token,method,body,headers)=>{if(!failed&&body?.requests?.some(r=>r.createDeveloperMetadata?.developerMetadata.metadataKey.startsWith('horas_calendar_done_'))){failed=true;throw Error('Fallo de Sheets');}return original(url,token,method,body,headers);};
    if(kind==='delete'){f.grids.get(0).push(row('old'));f.setEvents([event('old',{summary:'Bolo Tramuntana'})]);}
    const p=payload(kind,kind==='session'?input:{rowIdx:2}),plan=await preview(f,p);await assert.rejects(apply(f,p,plan),/Fallo/);
    const sync=await S.runDaily({spreadsheetId:P.TEST_ID,action:'preview',kind:'sync',input:{month:'2026-11'}},'token',f.request);assert.equal(sync.summary.length,0);assert.equal(sync.removals.length,0);assert(sync.skipped.some(s=>s.reason.includes('pendiente')));
    await C.runCalendarCrud({spreadsheetId:P.TEST_ID,action:'resume',operationId:p.operationId},'token',f.request);
  }
});
test('el diario permite lotes de cien sesiones sin superar el límite de texto por celda ni guardar tokens',async()=>{
  const f=fake({calendarWrites:true}),p=payload('session',{...input,address:'Calle '.repeat(160),repeat:{frequency:'DAILY',interval:1,until:'2027-02-12'}}),plan=await preview(f,p);assert.equal(plan.summary.length,100);await apply(f,p,plan);
  const journal=[...f.props.values()].find(p=>p.title===C.JOURNAL),cells=f.grids.get(journal.sheetId)[0];assert(cells.length>3);assert(cells.every(c=>String(D.value(c)).length<=45000));assert(!JSON.stringify(cells).includes('synthetic-token'));assert.equal(f.grids.get(0).length,101);
});
test('el endpoint de producción habilita el flujo revisado y mantiene bloqueados los proxies y calendarios ajenos',async()=>{
  const {createHandler}=require('../api/test.js'),f=fake({calendarWrites:true}),handler=createHandler({profile:'production',writeEnabled:true,calendarWriteEnabled:true,request:f.request});
  const call=async(api,body,method='POST')=>{const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};await handler({method,query:{api},body,headers:{host:'example.invalid',authorization:'Bearer test'}},res);return res;};
  const env=(await call('environment',undefined,'GET')).body;assert.equal(env.calendarReadOnly,false);assert.equal(env.calendarWrites,true);assert((await call('oauth',undefined,'GET')).body.scopes.includes('calendar.events.owned'));
  const p={...payload('session',input),spreadsheetId:P.ORIGINAL_ID},plan=await call('daily',{...p,action:'preview'});assert.equal(plan.code,200,JSON.stringify(plan.body));assert.equal((await call('daily',{...p,action:'apply',expectedVersion:plan.body.version})).code,200);
  assert.equal((await call('calendar',{method:'insert',params:{calendarId:'primary'}})).code,403);
  await P.withProfile('production',async()=>{const remote=require('./protected-runtime.cjs').scopedRequest(async()=>{throw Error('No debería acceder');},{writeEnabled:true,calendarWriteEnabled:true});await assert.rejects(remote('https://www.googleapis.com/calendar/v3/calendars/another/events','token','POST',{}),/fuera/);});
});
test('un cambio simultáneo entre lectura y escritura usa If-Match y no deja un bloqueo pendiente permanente',async()=>{
  for(const kind of ['edit','delete']){
    const f=fake({calendarWrites:true}),original=f.request;f.grids.get(0).push(row('work'));f.setEvents([event('work',{summary:'Bolo Tramuntana'})]);
    f.request=async(url,token,method,body,headers)=>{if(url.includes('/calendar/')&&['PATCH','DELETE'].includes(method))f.setEvents([event('work',{summary:'Bolo Tramuntana',etag:'changed-concurrently',location:'Calle editada en Google'})]);return original(url,token,method,body,headers);};
    const p=payload(kind,kind==='edit'?{...input,rowIdx:2,address:'Cambio de la app'}:{rowIdx:2}),plan=await preview(f,p);await assert.rejects(apply(f,p,plan),/simultáneo/);assert.equal((await pending(f)).items.length,0);assert.equal(D.value(f.grids.get(0)[1][11]),'Dirección especial');assert.equal((await original('https://www.googleapis.com/calendar/v3/calendars/primary/events/work','token')).location,'Calle editada en Google');
  }
});
test('si el evento ya existe se enlaza sin duplicarlo y una partida adicional comparte su referencia',async()=>{
  const f=fake({calendarWrites:true});f.setEvents([event('existing',{summary:'Bolo Tramuntana'})]);const p=payload('session',input),plan=await preview(f,p);assert.deepEqual(plan.calendarActions,[]);assert.equal(plan.summary[0].calendarId,'existing');await apply(f,p,plan);
  const extra=payload('session',{...input,total:'5,00'}),review=await preview(f,extra);assert.equal(review.duplicates,1);await assert.rejects(apply(f,extra,review),/partida adicional/);await C.runCalendarCrud({...extra,action:'apply',expectedVersion:review.version,allowSimilar:true},'token',f.request);
  assert.equal(f.grids.get(0).length,3);assert.equal(D.value(f.grids.get(0)[2][10]),'existing');assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
});
