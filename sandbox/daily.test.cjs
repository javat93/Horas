const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const S=require('./daily-service.cjs'),D=require('../locale-data.js'),{TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const clone=v=>JSON.parse(JSON.stringify(v)),c=v=>v===''?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v}};
function fake(){
  const grids=new Map([[0,[['Pago','Hecho','Bolo','Clase','Precio','Fecha','Total','H','Grupo','Barrio','CalendarId','Dirección','Inicio','Fin','Excepción'].map(c)]],[758405382,[['Grupo','Dirección','Precio','Bolo','Barrio'].map(c),['Moli de finestrelles','Dirección de catálogo',24,50,'Barrio catálogo'].map(c)]]]);
  const props=new Map([[0,{sheetId:0,title:'Detalle',gridProperties:{rowCount:2000,columnCount:15}}],[758405382,{sheetId:758405382,title:'Coles',gridProperties:{rowCount:100,columnCount:5}}]]),meta=[],calls=[];let throwAfterWrite=false;
  const native=rows=>rows.map(row=>({values:row.map(cell=>({...clone(cell),...(cell.userEnteredValue?{effectiveValue:clone(cell.userEnteredValue)}:{}),...(cell.userEnteredFormat?{effectiveFormat:clone(cell.userEnteredFormat)}:{})}))}));
  const request=async(url,token,method='GET',body)=>{
    calls.push({url,method,body:clone(body||{})});const u=new URL(url);
    if(url.startsWith('https://www.googleapis.com/calendar')){assert.equal(method,'GET');const p=u.searchParams.get('pageToken');return clone(p?{items:events2}:{items:events,...(events2.length?{nextPageToken:'page2'}:{})});}
    assert(url.startsWith(S.BASE),'Solo la copia');
    if(method==='POST'){
      for(const r of body.requests){
        if(r.addSheet){const p=clone(r.addSheet.properties);props.set(p.sheetId,p);grids.set(p.sheetId,[]);}
        if(r.appendCells){const a=r.appendCells;grids.get(a.sheetId).push(...a.rows.map(r=>clone(r.values)));}
        if(r.updateCells){const a=r.updateCells,rows=grids.get(a.range.sheetId);for(let i=0;i<a.rows.length;i++){const idx=a.range.startRowIndex+i;rows[idx]||=[];for(let j=0;j<a.rows[i].values.length;j++){const col=a.range.startColumnIndex+j,incoming=clone(a.rows[i].values[j]);if(a.fields==='userEnteredValue'){rows[idx][col]||={};delete rows[idx][col].userEnteredValue;if(incoming.userEnteredValue)rows[idx][col].userEnteredValue=incoming.userEnteredValue;}else rows[idx][col]=incoming;}}}
        if(r.createDeveloperMetadata)meta.push({...clone(r.createDeveloperMetadata.developerMetadata),metadataId:meta.length+1});
      }
      if(throwAfterWrite){throwAfterWrite=false;throw Error('timeout tras confirmar Google');}return {};
    }
    if(u.pathname.endsWith('values:batchGet'))return {valueRanges:[0,758405382].map(id=>({values:grids.get(id).map(row=>row.map(D.value))}))};
    if(u.pathname.includes('/values/')){const title=decodeURIComponent(u.pathname.split('/values/')[1]).replace(/^'/,'').split("'")[0];const id=[...props].find(([,p])=>p.title===title)?.[0];return {values:(grids.get(id)||[]).map(row=>row.map(D.value))};}
    if(u.searchParams.get('fields')?.startsWith('properties(locale'))return {properties:{locale:'es_ES',timeZone:'Europe/Madrid'},sheets:[...props.values()].map(properties=>({properties:clone(properties),developerMetadata:u.searchParams.get('fields').includes('gridProperties),developerMetadata')?clone(meta.filter(m=>(m.location.sheetId??m.location.dimensionRange?.sheetId)===properties.sheetId)):[]})),developerMetadata:[]};
    const ranges=u.searchParams.getAll('ranges');if(ranges.length===1){const row=Number(ranges[0].match(/A(\d+)/)[1]);return {sheets:[{properties:clone(props.get(758405382))},{properties:clone(props.get(0)),data:[{rowData:[{values:clone(grids.get(0)[row-1]||[])}]}]}]};}
    return {sheets:[0,758405382].map(id=>({properties:clone(props.get(id)),data:[{startRow:0,rowData:native(grids.get(id))}]}))};
  };
  let events=[],events2=[];
  return {request,grids,meta,calls,props,setEvents:(a,b=[])=>{events=a;events2=b;},timeout:()=>throwAfterWrite=true};
}
const input={group:'Tramuntana',date:'2026-11-05',start:'18:00',end:'19:15',price:'33,75',total:'40,25',district:'Barrio especial',address:'Dirección especial',gig:true};
const payload=(kind,input,rest={})=>({spreadsheetId:TEST_ID,kind,input,...rest});
const preview=(f,kind,input)=>S.runDaily(payload(kind,input,{action:'preview'}),'token',f.request,new Date('2026-11-02T12:00:00Z'));
const apply=(f,kind,input,p,extra={})=>S.runDaily(payload(kind,input,{action:'apply',expectedVersion:p.version,operationId:randomUUID(),...extra}),'token',f.request,new Date('2026-11-02T12:00:00Z'));
test('alta nativa conserva precio especial, total independiente, barrio y H=1; Calendar no escribe',async()=>{
  const f=fake(),p=await preview(f,'session',input);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
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
  for(const bad of [{...input,price:'1,2,3'},{...input,start:'23:30',end:'00:30'},{...input,calendarId:'personal'},{...input,group:'No existe'}])await assert.rejects(preview(f,'session',bad));assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
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
