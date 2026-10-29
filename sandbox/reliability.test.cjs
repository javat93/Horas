const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../app-data.js'),D=require('../locale-data.js'),Auth=require('../auth-session.js');
const {runState}=require('./state-service.cjs'),{fingerprint,readNative}=require('./locale-service.cjs');
const {TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const clone=structuredClone,cell=v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v},effectiveValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v},formattedValue:String(v)});
function fixture(options={}){
  const row=Array.from({length:15},()=>({}));for(const [i,v]of [[4,50],[5,D.serial('2026-10-10')],[6,50],[7,1],[8,'Cole'],[9,'Barrio especial'],[10,'event'],[11,'Calle particular']])row[i]=cell(v);
  const rows=[[],row],calls=[];let written=false;
  const request=async(url,token,method='GET',body)=>{calls.push({url,method,body});assert(url.includes(TEST_ID));assert(!url.includes('calendar'));if(url.includes('/values:batchGet'))return {valueRanges:[{values:rows.map(r=>r.map(D.value))},{values:[['Grupo']]}]};
    if(method==='POST'){if(options.failWrite)throw Error('Network interrupted');for(const r of body.requests){const u=r.updateCells;assert.equal(u.range.startColumnIndex,0);assert.equal(u.range.endColumnIndex,1);assert.equal(u.range.sheetId,0);const value=u.rows[0].values[0].userEnteredValue;rows[u.range.startRowIndex][0]=value?{userEnteredValue:value,effectiveValue:value}:{};}written=true;return {};}
    if(written&&options.failVerify)throw Error('Read failed');
    return {sheets:[{properties:{title:'Detalle'},data:[{rowData:rows.map(values=>({values:clone(values)}))}]},{properties:{title:'Coles'},data:[{rowData:[{values:[cell('Grupo')]}]}]}]};};
  const payload=()=>({spreadsheetId:TEST_ID,action:'setPayment',rowIdx:2,paid:true,expectedVersion:fingerprint(rows[1])});return {row,rows,calls,request,payload};
}
test('204 y respuesta vacía se procesan sin parsear JSON; error HTTP conserva detalle',async()=>{
  assert.deepEqual(await A.readResponse({status:204,ok:true,text:async()=>{throw Error('No body');}}),{});
  assert.deepEqual(await A.readResponse({status:200,ok:true,text:async()=>''}),{});
  await assert.rejects(()=>A.readResponse({status:503,ok:false,text:async()=>'{"error":{"message":"No disponible"}}'}),/503.*No disponible/);
  await assert.rejects(()=>A.readResponse({status:200,ok:true,text:async()=>'<html>Error</html>'}),/no válida/);
});
test('bloqueo de escrituras libera al fallar y no repite operaciones; lecturas no son escrituras',async()=>{
  const gate=A.createGate();let release,count=0;const first=gate.run(async()=>{count++;await new Promise(r=>release=r);throw Error('failed');});
  await assert.rejects(()=>gate.run(async()=>count++),/otra operación/);release();await assert.rejects(()=>first);await gate.run(async()=>count++);assert.equal(count,2);
  assert.equal(A.mutatingRequest('api/test?api=locale',{method:'POST',body:'{"action":"data"}'}),false);assert.equal(A.mutatingRequest('api/test?api=state',{method:'POST',body:'{"action":"setPayment"}'}),true);
});
test('filas de formato, falsas y huecos no son sesiones; cero e incompletas se conservan',()=>{
  assert.equal(A.hasContent(['',false,null,undefined,' ']),false);assert.equal(A.hasContent([0]),true);assert.equal(A.hasContent(['Calle sin completar']),true);
  const error={effectiveValue:{errorValue:{type:'VALUE'}}};assert.match(D.value(error),/#ERROR/);assert.equal(D.numeric(D.value(error)),null);
});
test('pago solo modifica A y conserva toda la sesión, con ida y vuelta y sin duplicar',async()=>{
  const f=fixture(),before=clone(f.rows[1]);const saved=await runState(f.payload(),'Bearer fake',f.request);assert.equal(saved.paid,true);assert.equal(saved.calendarModified,false);for(let i=1;i<14;i++)assert.deepEqual(f.rows[1][i],before[i]);
  const again=await runState(f.payload(),'Bearer fake',f.request);assert.equal(again.unchanged,true);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  await runState({...f.payload(),paid:false},'Bearer fake',f.request);assert.deepEqual(f.rows[1],before);
});
test('pago booleano se conserva; fórmulas, original y revisiones antiguas no se sobrescriben',async()=>{
  const f=fixture();f.row[0]=cell(false);await runState(f.payload(),'',f.request);assert.equal(f.row[0].userEnteredValue.boolValue,true);
  const stale=f.payload();f.row[9]=cell('Barrio manual nuevo');await assert.rejects(()=>runState(stale,'',f.request),/cambió/);
  f.row[0]={userEnteredValue:{formulaValue:'=TRUE()'},effectiveValue:{boolValue:true}};await assert.rejects(()=>runState({...f.payload(),paid:false},'',f.request),/fórmula/);
  let calls=0;await assert.rejects(()=>runState({...f.payload(),spreadsheetId:ORIGINAL_ID},'',async()=>calls++));assert.equal(calls,0);
});
test('escritura o verificación fallida no se anuncia como éxito ni se vuelve a enviar',async()=>{
  for(const options of [{failWrite:true},{failVerify:true}]){const f=fixture(options);await assert.rejects(()=>runState(f.payload(),'',f.request),/confirmar|comprobar/);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}
});
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function loader(load){
  const sync=html.slice(html.indexOf('        function syncData('),html.indexOf('        // Función para actualizar automáticamente las clases'));
  const context=vm.createContext({setTimeout,CONFIG:{TEST_MODE:true,TEST_PHASE:8},AppData:A,LocaleData:D,AuthSession:Auth,syncInFlight:null,eventos:[{rowIdx:99,total:20}],grupos:[{rowIdx:88,nombre:'Anterior'}],window:{loadNativeData:load,updateLocaleWarnings(){}},showLoading(){},hideLoading(){},renderAll(){},updateFinancialStats(){},document:{getElementById:()=>({})},console:{error(){}},parseSpanishNumber:v=>D.numeric(v)??0,proxyGoogleAPI:async()=>{throw Error('Unexpected write');}});vm.runInContext(sync,context);return context;
}
const data=()=>({groups:[['Cole','Calle',20,50,'Barrio']],details:[['','','','',20,'01/01/2020',20,1,'Cole'],[],[false,false,''],['','','','',0],['','','','',50,'10/10/2026',50,1,'Otro']],warnings:[],amountWarnings:[],rowVersions:['first','','','incomplete','last']});
test('carga real omite huecos sin desplazar filas y respeta Realizado de Sheets',async()=>{
  const c=loader(async()=>data());await c.syncData();assert.deepEqual(Array.from(c.eventos,e=>e.rowIdx),[6,2,5]);assert.equal(c.eventos.find(e=>e.rowIdx===2).realizado,false);assert.equal(c.eventos.find(e=>e.rowIdx===6).sourceVersion,'last');assert.equal(c.eventos.find(e=>e.rowIdx===5).amountWarning,true);
});
test('recargas simultáneas se agrupan; error de carga mantiene los datos anteriores y se propaga',async()=>{
  let resolve,calls=0;const c=loader(()=>{calls++;return new Promise(r=>resolve=r);});const first=c.syncData(),second=c.syncData();assert.equal(first,second);resolve(data());await first;assert.equal(calls,1);
  const failed=loader(async()=>{throw Error('Sin red');});await assert.rejects(()=>failed.syncData(),/Sin red/);assert.equal(failed.eventos[0].rowIdx,99);assert.equal(failed.grupos[0].rowIdx,88);
});
test('pago fallido restaura vista y resumen, bloqueando dobles envíos',async()=>{
  const fn=html.slice(html.indexOf('        async function togglePago('),html.indexOf('        function toggleRecurrence('));let reject,calls=0,lastTotal;
  const event={rowIdx:2,pagado:false,total:50},errors=[];const c=vm.createContext({eventos:[event],CONFIG:{TEST_MODE:false},renderAll(){},updateFinancialStats(){lastTotal=event.pagado?0:50;},proxyGoogleAPI:()=>{calls++;return new Promise((_,r)=>reject=r);},showErrorModal:(...args)=>errors.push(args),document:{getElementById:()=>({})}});vm.runInContext(fn,c);
  const pending=c.togglePago(2,true);assert.equal(lastTotal,0);await c.togglePago(2,true);assert.equal(calls,1);reject(Error('Fallo'));await pending;assert.equal(lastTotal,50);assert.equal(event.pagado,false);assert.equal(event.paymentUncertain,true);assert.equal(errors.length,1);
});
test('lectura nativa conserva el número de una fila posterior a 3000 y acota los metadatos',async()=>{
  const rows=Array.from({length:4002},()=>[]);rows[0]=[cell('Pagado')];rows[4001]=Array.from({length:14},()=>({}));rows[4001][8]=cell('Último');rows[4001][5]=cell(D.serial('2026-10-29'));let bounded=false;
  const request=async url=>{if(url.includes('/values:batchGet'))return {valueRanges:[{values:rows.map(r=>r.map(D.value))},{values:[['Grupo']]}]};assert.equal(new URL(url).searchParams.getAll('ranges')[0],'Detalle!A1:O4002');bounded=true;return {sheets:[{properties:{title:'Detalle'},data:[{rowData:rows.map(values=>({values}))}]},{properties:{title:'Coles'},data:[{rowData:[{values:[cell('Grupo')]}]}]}]};};
  const result=await readNative('',request);assert.equal(bounded,true);assert.equal(result.details[4000][8],'Último');assert.equal(result.rowVersions.length,4001);
});

test('automatismo de la interfaz solo actualiza Realizado confirmado y no repite fallos',async()=>{
  let calls=0,fail=false;const elements={'performed-status':{}},event={rowIdx:2,realizado:false,calEventId:'event',horaFin:'10:00',total:50};
  const window={horasEnvironmentReady:Promise.resolve(true),horasAccessToken:()=> 'fake',horasOperationBusy:()=>false,horasFetch:async()=>{calls++;if(fail)throw Error('Sin confirmar');return {status:200,ok:true,text:async()=>JSON.stringify({spreadsheetId:TEST_ID,calendarModified:false,performed:[{rowIdx:2,version:'new'}],rowsChanged:1,nextCursor:0})};}};
  let time=100000;const c=vm.createContext({window,CONFIG:{TEST_MODE:true,TEST_PHASE:8,SPREADSHEET_ID:TEST_ID},eventos:[event],AppData:A,Date:{now:()=>time},document:{hidden:false,getElementById:id=>elements[id],addEventListener(){}},renderAll(){},updateFinancialStats(){}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'performed-editor.js'),'utf8'),c);await window.runAutoPerformed();assert.equal(calls,1);assert.equal(event.realizado,true);assert.equal(event.sourceVersion,'new');assert.equal(event.total,50);
  event.realizado=false;time+=61000;fail=true;await window.runAutoPerformed();time+=61000;await window.runAutoPerformed();assert.equal(calls,2);assert.match(elements['performed-status'].textContent,/detenido/);assert.equal(event.realizado,false);
});
