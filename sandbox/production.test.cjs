const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createHandler}=require('../api/test.js'),P=require('./policy.cjs'),C=require('../protected-config.js');
const {scopedRequest,releaseSettings}=require('./protected-runtime.cjs'),{fake,c,clone}=require('./fixtures/daily.cjs');
const D=require('../locale-data.js'),S=require('./daily-service.cjs');
async function call(handler,api,body,method='POST'){
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.body=data;return this;},end(){return this;}};
  await handler({method,query:{api},body,headers:{host:'example.invalid',origin:'https://javat93.github.io',authorization:'Bearer synthetic-token'}},res);return res;
}
const session={group:'Tramuntana',date:'2099-01-02',start:'10:00',end:'11:15',price:'33,75',total:'40,25',district:'Barrio manual',address:'Dirección manual',gig:true};
test('producción queda cerrada por defecto y exige verificación de migración antes de lectura real',()=>{
  assert.throws(()=>releaseSettings({}),/pendiente/);
  assert.throws(()=>releaseSettings({HORAS_PROTECTED_PROFILE:'production'}),/migración/);
  assert.deepEqual(releaseSettings({HORAS_PROTECTED_PROFILE:'production',HORAS_MIGRATION_VERIFIED:'migracion-20261102'}),{profile:'production',writeEnabled:false});
  assert.deepEqual(releaseSettings({HORAS_PROTECTED_PROFILE:'rehearsal',HORAS_PROTECTED_WRITES:'enabled'}),{profile:'rehearsal',writeEnabled:true});
});
test('proxies antiguos no admiten escrituras de Sheets o Calendar ni acceso a la hoja real',async()=>{
  for(const [api,methods]of [['sheets',['update','append','batchUpdate']],['calendar',['insert','update','delete']]]){
    const legacy=require('../api/'+api+'.js');
    for(const method of methods){const response=await call(legacy,api,{method,params:{spreadsheetId:P.TEST_ID,range:'Detalle!A1',calendarId:'primary'},body:{requests:[]}});assert.equal(response.code,403);}
  }
  const read=await call(require('../api/sheets.js'),'sheets',{method:'get',params:{spreadsheetId:P.ORIGINAL_ID,range:'Detalle!A1'}});assert.equal(read.code,403);
});
test('perfiles concurrentes no comparten destino ni alteran el perfil de pruebas',async()=>{
  await Promise.all(['test','rehearsal','production'].map(profile=>P.withProfile(profile,async()=>{
    const id=P.targetId();await new Promise(r=>setTimeout(r,5));assert.equal(P.targetId(),id);P.validateTarget(id);
    for(const other of [P.TEST_ID,P.REHEARSAL_ID,P.ORIGINAL_ID].filter(v=>v!==id))assert.throws(()=>P.validateTarget(other));
  })));
  assert.equal(P.targetId(),P.TEST_ID);assert.throws(()=>P.withProfile('arbitrary',()=>{}));
});
test('barrera remota bloquea destinos ajenos, Calendar de escritura y Sheets en modo lectura',async()=>P.withProfile('production',async()=>{
  const calls=[],request=scopedRequest(async(...args)=>{calls.push(args);return {};});
  for(const [url,method]of [[`https://sheets.googleapis.com/v4/spreadsheets/${P.TEST_ID}`,'GET'],[`https://sheets.googleapis.com/v4/spreadsheets/${P.ORIGINAL_ID}extra`,'GET'],['https://example.invalid','GET'],['https://www.googleapis.com/calendar/v3/calendars/primary/events','POST'],[`https://sheets.googleapis.com/v4/spreadsheets/${P.ORIGINAL_ID}:batchUpdate`,'POST']])await assert.rejects(request(url,'fake',method));
  assert.equal(calls.length,0);await request(`https://sheets.googleapis.com/v4/spreadsheets/${P.ORIGINAL_ID}/developerMetadata:search`,'fake','POST',{});assert.equal(calls.length,1);
}));
for(const profile of ['rehearsal','production']){
  const config=C.create(profile),id=config.SPREADSHEET_ID;
  test(profile+': configuración conserva protecciones con TEST_MODE=false y verifica destino/capacidades',async()=>{
    const handler=createHandler({profile,writeEnabled:false,request:async()=>{throw Error('Sin red');}}),env=(await call(handler,'environment',null,'GET')).body;
    assert.equal(config.TEST_MODE,false);assert.equal(config.PROTECTED_MODE,true);assert.equal(env.spreadsheetId,id);assert.equal(env.automaticWrites,false);C.verify(config,env);
    for(const bad of [{...env,spreadsheetId:P.TEST_ID},{...env,mode:'test'},{...env,protectedMode:false},{...env,calendarReadOnly:false},{...env,automaticWrites:true}])assert.throws(()=>C.verify(config,bad));
    assert.equal(new URL(config.DAILY_API_URL).pathname,'/api/production');assert(!config.SCOPES.includes('auth/calendar '));assert.throws(()=>C.create('arbitrary'));
  });
  test(profile+': destino cruzado, pruebas temporales y operaciones antiguas se rechazan antes de la red',async()=>{
    let calls=0;const handler=createHandler({profile,writeEnabled:true,request:async()=>{calls++;throw Error('Sin red');}});
    for(const [api,body]of [['daily',{spreadsheetId:P.TEST_ID,action:'preview',kind:'session',input:session}],['control',{spreadsheetId:id}],['locale',{spreadsheetId:id,action:'check'}],['calendar',{method:'delete',params:{calendarId:'primary',eventId:'personal'}}],['sheets',{method:'append',params:{spreadsheetId:id,range:'Detalle!A1'}}]])assert.equal((await call(handler,api,body)).code,403);
    assert.equal(calls,0);
  });
  test(profile+': lectura nativa y revisión disponibles, confirmación bloqueada sin activar escrituras',async()=>{
    const f=fake(),handler=createHandler({profile,writeEnabled:false,request:f.request});
    const p=await call(handler,'daily',{spreadsheetId:id,action:'preview',kind:'session',input:session});assert.equal(p.code,200,JSON.stringify(p.body));assert.equal(p.body.spreadsheetId,id);
    assert.equal((await call(handler,'locale',{spreadsheetId:id,action:'data'})).code,200);
    const r=await call(handler,'daily',{spreadsheetId:id,action:'apply',kind:'session',input:session,expectedVersion:p.body.version,operationId:randomUUID()});assert.equal(r.code,403);
    assert(!f.calls.some(c=>c.url.endsWith(':batchUpdate')));
  });
  test(profile+': catálogo, importación y Realizado utilizan el perfil protegido sin escribir Calendar',async()=>{
    const f=fake(),handler=createHandler({profile,writeEnabled:true,request:f.request});f.grids.get(0)[0][14]={};
    const group=await call(handler,'groups',{spreadsheetId:id,action:'preview',rowIdx:2,proposal:{price:'25,50',location:'Barrio nuevo'}});assert.equal(group.code,200,JSON.stringify(group.body));
    const changed=await call(handler,'groups',{spreadsheetId:id,action:'apply',rowIdx:2,proposal:{price:'25,50',location:'Barrio nuevo'},expectedVersion:group.body.expectedVersion,choices:{price:'use',location:'keep'}});assert.equal(changed.code,200,JSON.stringify(changed.body));assert.equal(D.value(f.grids.get(758405382)[1][2]),25.5);assert.equal(D.value(f.grids.get(758405382)[1][4]),'Barrio catálogo');
    const event={id:'ended',summary:'Tramuntana',colorId:'5',start:{dateTime:'2026-10-05T18:00:00+02:00'},end:{dateTime:'2026-10-05T19:00:00+02:00'}};
    f.setEvents([event]);f.grids.get(0).push(S.rowFor({...session,group:'Moli de finestrelles',date:'2026-10-05',start:'18:00',end:'19:00',price:100,total:110,calendarId:'ended'}));
    const done=await call(handler,'state',{spreadsheetId:id,action:'autoPerformed'});assert.equal(done.code,200,JSON.stringify(done.body));assert.equal(done.body.rowsChanged,1);assert.equal(D.value(f.grids.get(0)[1][1]),'X');assert.equal(D.value(f.grids.get(0)[1][6]),110);assert.equal(D.value(f.grids.get(0)[1][9]),session.district);
    const imports=await call(handler,'daily',{spreadsheetId:id,action:'preview',kind:'import',input:{month:'2099-01'}});assert.equal(imports.code,200,JSON.stringify(imports.body));assert.equal(imports.body.summary.length,0);
    const links=await call(handler,'links',{spreadsheetId:id,action:'audit'});assert.equal(links.code,200,JSON.stringify(links.body));assert.equal(links.body.rows.length,1);
    assert(f.calls.filter(c=>c.url.includes('sheets.googleapis.com')).every(c=>c.url.includes('/'+id)));assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
  });
  test(profile+': alta, idempotencia, pago y papelera/restauración conservan importes, barrio y fecha nativos',async()=>{
    const f=fake(),handler=createHandler({profile,writeEnabled:true,request:f.request});
    const preview=async(kind,input)=>{const r=await call(handler,'daily',{spreadsheetId:id,action:'preview',kind,input});assert.equal(r.code,200,JSON.stringify(r.body));return r.body;};
    const apply=async(kind,input,p,operationId=randomUUID())=>call(handler,'daily',{spreadsheetId:id,action:'apply',kind,input,expectedVersion:p.version,operationId});
    const p=await preview('session',session),op=randomUUID(),added=await apply('session',session,p,op);assert.equal(added.code,200,JSON.stringify(added.body));assert.equal((await apply('session',session,p,op)).body.alreadyApplied,true);assert.equal(f.grids.get(0).length,2);
    const row=f.grids.get(0)[1];assert.equal(D.value(row[4]),33.75);assert.equal(D.value(row[6]),40.25);assert.equal(D.value(row[7]),1);assert.equal(D.value(row[9]),session.district);assert.equal(D.value(row[11]),session.address);assert.equal(D.value(row[5]),D.serial(session.date));
    const data=(await call(handler,'locale',{spreadsheetId:id,action:'data'})).body;
    const paid=await call(handler,'state',{spreadsheetId:id,action:'setPayment',rowIdx:2,paid:true,expectedVersion:data.rowVersions[0]});assert.equal(paid.code,200,JSON.stringify(paid.body));assert.equal(D.value(row[0]),'X');
    const saved=clone(row),deleted=await apply('delete',{rowIdx:2},await preview('delete',{rowIdx:2}));assert.equal(deleted.code,200,JSON.stringify(deleted.body));assert(S.values(row).every(v=>!Object.keys(v).length));
    const trash=(await call(handler,'daily',{spreadsheetId:id,action:'trash'})).body;assert.equal(trash.items.length,1);
    const restore={operationId:deleted.body.operationId};assert.equal((await apply('restore',restore,await preview('restore',restore))).code,200);assert.deepEqual(f.grids.get(0)[1],saved);
    assert(f.calls.filter(c=>c.url.includes('sheets.googleapis.com')).every(c=>c.url.includes('/'+id)));
    assert(!f.calls.some(c=>c.url.includes('/calendar/')&&c.method!=='GET'));
  });
  test(profile+': sincronizar conserva excepciones manuales hasta aceptar explícitamente precio/barrio/dirección',async()=>{
    const f=fake(),handler=createHandler({profile,writeEnabled:true,request:f.request}),e={id:'work',summary:'Tramuntana',colorId:'5',start:{dateTime:'2026-11-05T18:00:00+01:00'},end:{dateTime:'2026-11-05T19:00:00+01:00'},location:'Dirección de Calendar'};
    f.setEvents([e]);f.grids.get(0).push(S.rowFor({...session,group:'Moli de finestrelles',date:'2026-11-05',start:'18:00',end:'19:00',price:100,total:110,calendarId:'work'}));
    const body={spreadsheetId:id,action:'preview',mode:'sync',month:'2026-11'},p=await call(handler,'protected',body);assert.equal(p.code,200,JSON.stringify(p.body));assert(p.body.plans[0].diff.money);assert(p.body.plans[0].diff.district);assert(p.body.plans[0].diff.address);
    const decisions=p.body.plans.map(plan=>({rowIdx:plan.rowIdx,expectedVersion:plan.expectedVersion,proposalVersion:plan.proposalVersion,choices:{money:'keep',district:'keep',address:'keep',time:'keep'}}));
    const kept=await call(handler,'protected',{...body,action:'apply',catalogVersion:p.body.catalogVersion,decisions});assert.equal(kept.code,200,JSON.stringify(kept.body));assert.equal(kept.body.unchanged,true);assert.equal(D.value(f.grids.get(0)[1][6]),110);assert.equal(D.value(f.grids.get(0)[1][9]),session.district);
    f.grids.get(0)[1][9]=c('Nueva edición en Sheets');decisions[0].choices.district='accept';assert.equal((await call(handler,'protected',{...body,action:'apply',catalogVersion:p.body.catalogVersion,decisions})).code,502);
    assert(!f.calls.some(c=>c.url.endsWith(':batchUpdate')));
  });
}
