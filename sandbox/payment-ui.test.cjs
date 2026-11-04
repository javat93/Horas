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
test('varios pagos se muestran al instante y se guardan en orden sin bloquear otras filas',async()=>{
  let release,calls=0;const h=harness(async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return response();});
  const first=h.context.togglePago(2,true);await tick();const second=h.context.togglePago(3,true);await tick();
  assert.equal(calls,1);assert.equal(h.events[0].pagado,true);assert.equal(h.events[1].pagado,true);assert.equal(h.events[1].paymentSaving,true);
  release();await Promise.all([first,second]);assert.equal(calls,2);assert.equal(h.errors.length,0);assert.equal(h.events[1].paymentSaving,false);assert.equal(h.window.horasOperationBusy(),false);
});
test('un pago espera al automatismo y continúa al terminar de leer su respuesta',async()=>{
  let release,calls=0;const h=harness(async()=>{calls++;const r=response();if(calls===1)r.clone=()=>({text:()=>new Promise(resolve=>release=resolve)});return r;});
  const auto=h.window.horasFetch('/state',{method:'POST',body:JSON.stringify({action:'autoPerformed'})});await tick();const payment=h.context.togglePago(2,true);await tick();
  assert.equal(calls,1);assert.equal(h.events[0].pagado,true);release('{}');await Promise.all([auto,payment]);assert.equal(calls,2);assert.equal(h.events[0].pagado,true);assert.equal(h.errors.length,0);
});
test('un fallo restaura solo la sesión afectada y los siguientes pagos continúan',async()=>{
  let calls=0;const h=harness(async(url,options)=>{const body=JSON.parse(options.body);calls++;if(body.rowIdx===2)throw Error('Sin red');return response();});
  await Promise.all([h.context.togglePago(2,true),h.context.togglePago(3,true)]);
  assert.equal(h.events[0].pagado,false);assert.equal(h.events[0].paymentUncertain,false);assert.equal(h.events[0].paymentSaving,false);assert.equal(h.events[1].pagado,true);assert.equal(h.events[0].paymentError,true);assert.equal(h.events[1].paymentError,false);assert.equal(h.errors.length,1);assert.equal(h.errors[0][0],'Pago no guardado');assert.equal(h.errors[0][2],'warning');assert.equal(calls,3);
});
test('una respuesta perdida se concilia leyendo el pago sin volver a escribir',async()=>{
  const actions=[];const h=harness(async(url,options)=>{const body=JSON.parse(options.body);actions.push(body.action);if(body.action==='setPayment')throw Error('Respuesta perdida');return response();});
  await h.context.togglePago(2,true);assert.equal(h.events[0].pagado,true);assert.equal(h.events[0].sourceVersion,'saved');assert.equal(h.events[0].paymentUncertain,false);assert.deepEqual(actions,['setPayment','getPayment']);
});
test('un doble clic sobre la misma sesión solo envía un pago',async()=>{
  let release,calls=0;const h=harness(async()=>{calls++;await new Promise(r=>release=r);return response();});
  const first=h.context.togglePago(2,true);await tick();await h.context.togglePago(2,false);assert.equal(calls,1);release();await first;assert.equal(h.events[0].pagado,true);
});
test('las peticiones interrumpidas liberan la cola y permiten volver a intentar',async()=>{
  let expire,calls=0;const h=harness(async(url,{signal})=>{calls++;if(!signal)throw Error('Sin red');return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Tiempo agotado'))));},{setTimeout:fn=>{expire=fn;return 1;},clearTimeout(){}});
  const payment=h.context.togglePago(2,true);await tick();expire();await payment;assert.equal(calls,2);assert.equal(h.events[0].pagado,false);assert.equal(h.events[0].paymentUncertain,false);assert.equal(h.window.horasOperationBusy(),false);
});
