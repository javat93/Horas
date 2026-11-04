const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const AppData=require('../app-data.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetch,extras={}){
  const events=[2,3].map(rowIdx=>({rowIdx,pagado:false,total:24,sourceVersion:'initial'})),errors=[];
  const window={horasEnvironmentReady:Promise.resolve(true),horasWritesEnabled:true};
  const context=vm.createContext({window,AppData,CONFIG:{PROTECTED_MODE:true,SPREADSHEET_ID:'fixture',STATE_API_URL:'/state'},eventos:events,fetch,setTimeout,clearTimeout,AbortController,renderAll(){},updateFinancialStats(){},showErrorModal:(...args)=>errors.push(args),document:{getElementById:()=>({})},...extras});
  const state=html.slice(html.indexOf('        let tokenClient;'),html.indexOf('        let eventos = []'));
  const payment=html.slice(html.indexOf('        async function togglePago('),html.indexOf('        function toggleRecurrence('));
  vm.runInContext(state+payment,context);window.horasAccessToken=()=> 'synthetic';
  return {context,window,events,errors};
}
function response(){const data={paid:true,version:'saved',spreadsheetId:'fixture',calendarModified:false};return {ok:true,status:200,text:async()=>JSON.stringify(data),clone:()=>({text:async()=>JSON.stringify(data)})};}
test('pago bloqueado por otro guardado no enviado se puede reintentar sin recargar',async()=>{
  let release,calls=0;const h=harness(async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return response();});
  const first=h.context.togglePago(2,true);await tick();await h.context.togglePago(3,true);
  assert.equal(calls,1);assert.equal(h.events[1].pagado,false);assert.equal(h.events[1].paymentUncertain,false);assert.equal(h.events[1].paymentSaving,false);
  assert.equal(h.errors[0][0],'Pago no enviado');release();await first;await h.context.togglePago(3,true);
  assert.equal(calls,2);assert.equal(h.events[0].pagado,true);assert.equal(h.events[1].pagado,true);assert.equal(h.window.horasOperationBusy(),false);
});
test('el bloqueo cubre la lectura del cuerpo y se libera tras el automatismo',async()=>{
  let release,calls=0;const h=harness(async()=>{calls++;const r=response();if(calls===1)r.clone=()=>({text:()=>new Promise(resolve=>release=resolve)});return r;});
  const auto=h.window.horasFetch('/state',{method:'POST',body:JSON.stringify({action:'autoPerformed'})});await tick();
  assert.equal(h.window.horasOperationBusy(),true);await h.context.togglePago(2,true);assert.equal(calls,1);assert.equal(h.events[0].paymentUncertain,false);
  release('{}');await auto;await h.context.togglePago(2,true);assert.equal(h.events[0].pagado,true);assert.equal(calls,2);
});
test('bloqueo de otra pestaña, carga inicial y conexión vencida no dejan un pago incierto',async()=>{
  for(const kind of ['tab','load','auth']){
    let calls=0;const h=harness(async()=>{calls++;return response();},kind==='tab'?{navigator:{locks:{request:async(name,options,fn)=>fn(null)}}}:{});
    if(kind==='load')vm.runInContext('syncInFlight=Promise.resolve()',h.context);
    if(kind==='auth')h.window.horasAccessToken=()=>{throw Error('Renueva la conexión');};
    await h.context.togglePago(2,true);assert.equal(calls,0);assert.equal(h.events[0].paymentUncertain,false);assert.equal(h.events[0].paymentSaving,false);assert.equal(h.events[0].pagado,false);
  }
});
test('petición interrumpida después de enviarse conserva la protección y libera el bloqueo',async()=>{
  let expire,calls=0;const h=harness(async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Tiempo agotado'))));},{setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){}});
  const payment=h.context.togglePago(2,true);await tick();expire();await payment;
  assert.equal(calls,1);assert.equal(h.events[0].paymentUncertain,true);assert.equal(h.events[0].paymentSaving,false);assert.equal(h.window.horasOperationBusy(),false);
  await h.context.togglePago(2,true);assert.equal(calls,1);
});
