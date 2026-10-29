const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../calendar-linking.js');
const {runLinks}=require('./link-service.cjs');
const {TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const row={rowIdx:2,grupo:'Molí de finestrelles',fechaStr:'28/09/2026',horaInicio:'18:30',horaFin:'19:30',calEventId:''};
const event={id:'moli',summary:'Moli de finestrelles',colorId:'5',status:'confirmed',start:{dateTime:'2026-09-28T18:30:00+02:00'},end:{dateTime:'2026-09-28T19:30:00+02:00'}};
test('nunca asigna el único evento ajeno, ni uno que solo comparte barrio',()=>{
  assert.equal(L.choose(row,[{...event,summary:'Dentista'}]).status,'unmatched');
  assert.equal(L.choose({...row,grupo:'Slap Martes',sitio:'Sant Andreu'},[event]).status,'unmatched');
});
test('solo amarillo, no cancelado y coincidencia completa de grupo, día y horario',()=>{
  assert.equal(L.choose(row,[event]).status,'matched');
  for(const candidate of [{...event,colorId:'1'},{...event,status:'cancelled'},{...event,summary:'Moli de finestrelles Jr'},{...event,start:{dateTime:'2026-09-29T18:30:00+02:00'}},{...event,end:{dateTime:'2026-09-28T20:30:00+02:00'}}])assert.equal(L.choose(row,[candidate]).status,'unmatched');
  assert.equal(L.choose(row,[{...event,summary:'Bolo Molí de finestrelles - Sant Andreu'}]).status,'matched');
});
test('no importa alias de Tramuntana como cole nuevo durante esta fase',()=>{
  assert.equal(L.choose(row,[{...event,summary:'Tramuntana'}]).status,'unmatched');
});
test('dos coincidencias requieren elegir; un ID de otra fila no puede asignarse',()=>{
  assert.equal(L.choose(row,[event,{...event,id:'otro'}]).status,'ambiguous');
  assert.equal(L.choose(row,[event],[{rowIdx:3,calEventId:'moli'}]).status,'claimed');
  assert.throws(()=>L.assertUniqueLinks([{rowIdx:2,calEventId:'moli'},{rowIdx:3,calEventId:'moli'}]),/compartidos/);
});
test('paginación completa, incluidos páginas vacías, y detección de tokens repetidos',async()=>{
  const calls=[];
  const result=await L.listAll(async params=>{calls.push(params);return !params.pageToken?{items:[],nextPageToken:'p2'}:{items:[event,event]};},{calendarId:'primary'});
  assert.equal(calls.length,2);assert.equal(calls[1].pageToken,'p2');assert.equal(result.items.length,1);
  await assert.rejects(()=>L.listAll(async()=>({items:[],nextPageToken:'repite'}),{}),/repitió/);
});
test('fechas y horas se comparan en Madrid sin depender de la zona del servidor',()=>{
  assert.equal(L.dateKey('31/02/2026'),'');assert.equal(L.dateKey('8/02/2026'),'2026-02-08');
  assert.equal(L.time('8:30'),'08:30');
  assert.equal(L.calendarDate({start:{dateTime:'2026-09-27T23:00:00Z'}}),'2026-09-28');
  assert.equal(L.eventKey({...row,fechaStr:'8/02/2026',horaInicio:'8:30'}),L.eventKey({...row,grupo:' Moli de finestrelles ',fechaStr:'08/02/2026',horaInicio:'08:30'}));
});
function makeRow(name='Molí de finestrelles',id='incorrecto'){
  return ['X','X','','X','37,50','28/09/2026','37,50 €','1',name,'Barrio manual',id,'Dirección particular','18:30','19:30'];
}
function mock(values,opts={}){
  const calls=[];let reads=0;let saved=null;
  const request=async(url,token,method='GET',body)=>{
    calls.push({url,method,body});
    if(url.includes('sheets.googleapis.com')){
      assert(url.includes(TEST_ID));assert(!url.includes(ORIGINAL_ID));
      if(method==='PUT'){saved=body.values[0][0];return {};}
      if(!url.includes('/values/')){
        reads++;const data=opts.fresh&&reads>1?opts.fresh:values;
        const cells=v=>({userEnteredValue:{[typeof v==='number'?'numberValue':'stringValue']:v},effectiveValue:{[typeof v==='number'?'numberValue':'stringValue']:v},formattedValue:String(v)});
        return {sheets:[{properties:{title:'Detalle'},data:[{startRow:1,rowData:data.map(row=>({values:row.map(cells)}))}]},{properties:{title:'Coles'},data:[{rowData:[{values:[]}]}]}]};
      }
      const range=decodeURIComponent(url.split('/values/')[1].split('?')[0]);
      if(range.startsWith('Detalle!K'))return {values:[[saved]]};
      reads++;const data=opts.fresh&&reads>1?opts.fresh:values;return {values:data};
    }
    assert.equal(method,'GET','Calendar nunca debe recibir una escritura');
    if(url.includes('/events?'))return {items:[event]};
    return opts.event||event;
  };
  return {calls,request};
}
test('análisis y candidatos solo leen; no recrean un evento ausente',async()=>{
  const v=makeRow();const m=mock([v]);
  const audit=await runLinks({spreadsheetId:TEST_ID,action:'audit'},'Bearer fake',m.request);assert.equal(audit.rows.length,1);
  const result=await runLinks({spreadsheetId:TEST_ID,action:'candidates',rowIdx:2,expectedRow:v},'Bearer fake',m.request);
  assert.equal(result.status,'matched');assert(m.calls.every(c=>c.method==='GET'));
});
test('guardar cambia solo K de la copia y conserva precios y barrio manual',async()=>{
  const values=[makeRow()];const m=mock(values);
  const result=await runLinks({spreadsheetId:TEST_ID,action:'apply',rowIdx:2,expectedRow:values[0],newEventId:'moli'},'Bearer fake',m.request);
  const writes=m.calls.filter(c=>c.method!=='GET');assert.equal(writes.length,1);
  assert.match(decodeURIComponent(writes[0].url),/Detalle!K2\?valueInputOption=RAW$/);
  assert.deepEqual(writes[0].body,{values:[['moli']]});assert.equal(result.calendarModified,false);
  assert.equal(values[0][4],'37,50');assert.equal(values[0][9],'Barrio manual');
});
test('dejar sin vincular limpia solo K y no elimina el evento',async()=>{
  const v=makeRow();const m=mock([v]);await runLinks({spreadsheetId:TEST_ID,action:'apply',rowIdx:2,expectedRow:v,newEventId:''},'Bearer fake',m.request);
  assert(!m.calls.some(c=>c.url.includes('calendar')));assert.deepEqual(m.calls.find(c=>c.method==='PUT').body,{values:[['']]});
});
test('protege frente a filas desplazadas/cambiadas y IDs ocupados antes de escribir',async()=>{
  const v=makeRow();const payload={spreadsheetId:TEST_ID,action:'apply',rowIdx:2,expectedRow:v,newEventId:'moli'};
  for(const m of [mock([makeRow('Otro')]),mock([v,makeRow('Otro','moli')]),mock([v],{fresh:[makeRow('Cambió')]}),mock([v],{fresh:[v,makeRow('Otro','moli')]})]){
    await assert.rejects(()=>runLinks(payload,'Bearer fake',m.request));assert(m.calls.every(c=>c.method==='GET'));
  }
});
test('no permite forzar un ID personal, cancelado ni de otro grupo',async()=>{
  const v=makeRow();for(const bad of [{...event,colorId:'1'},{...event,status:'cancelled'},{...event,summary:'Dentista'}]){
    const m=mock([v],{event:bad});await assert.rejects(()=>runLinks({spreadsheetId:TEST_ID,action:'apply',rowIdx:2,expectedRow:v,newEventId:'moli'},'Bearer fake',m.request));assert(m.calls.every(c=>c.method==='GET'));
  }
});
test('rechaza el original sin siquiera leer y repetir la confirmación no vuelve a escribir',async()=>{
  const m=mock([makeRow()]);await assert.rejects(()=>runLinks({spreadsheetId:ORIGINAL_ID,action:'audit'},'Bearer fake',m.request));assert.equal(m.calls.length,0);
  const v=makeRow('Molí de finestrelles','moli');const n=mock([v]);const result=await runLinks({spreadsheetId:TEST_ID,action:'apply',rowIdx:2,expectedRow:v,newEventId:'moli'},'Bearer fake',n.request);assert.equal(result.unchanged,true);assert(n.calls.every(c=>c.method==='GET'));
});
test('el panel monta el revisor después de verificar el backend, con banner existente o nuevo',async()=>{
  for(const [exists,phase]of [[true,2],[false,2],[true,3],[false,3],[true,4],[false,4],[true,5],[false,5]]){
    const elements={};const element=()=>({addEventListener(){},style:{},append(){}});
    for(const id of ['test-target-status','test-result','test-control','auth-btn','test-reload','sync-btn'])elements[id]=element();
    if(exists)elements['test-environment-banner']=element();
    let ready,mounted,protectedMounted,localeMounted,groupMounted;
    const window={horasConfigReady:Promise.resolve(),mountGroupReview:el=>{groupMounted=el},mountCalendarReview:el=>{mounted=el},mountProtectedReview:el=>{protectedMounted=el},mountLocaleReview:el=>{localeMounted=el}};
    const document={getElementById:id=>elements[id],createElement:()=>element(),body:{prepend:el=>{elements[el.id]=el}},addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')ready=fn}};
    const context=vm.createContext({window,document,CONFIG:{TEST_MODE:true,TEST_PHASE:phase,SPREADSHEET_ID:TEST_ID,PROXY_URL:'https://example.invalid'},fetch:async()=>({ok:true,json:async()=>({mode:'test',phase,groupReview:true,linkReview:true,protectedReview:true,localeReview:true,spreadsheetId:TEST_ID,calendarReadOnly:true,automaticWrites:false,appWrites:false})})});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'panel.js'),'utf8'),context);
    await ready();assert.equal(await window.horasEnvironmentReady,true);assert.equal(mounted,elements['test-environment-banner']);assert.match(elements['test-target-status'].textContent,/Backend comprobado/);
    if(phase>=3){assert.equal(protectedMounted,elements['test-environment-banner']);assert.equal(elements['sync-btn'].disabled,false);}if(phase>=4)assert.equal(localeMounted,elements['test-environment-banner']);if(phase>=5)assert.equal(groupMounted,elements['test-environment-banner']);
  }
});
