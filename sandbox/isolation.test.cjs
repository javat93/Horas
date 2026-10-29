const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {ORIGINAL_ID,TEST_ID,validateTarget,validateOperation}=require('./policy.cjs');
const {createServer,controlProbe,testPage,testConfig}=require('./server.cjs');
const deployedHandler=require('../api/test.js');

test('solo se acepta la copia exacta, nunca el original ni un destino omitido',()=>{
  assert.doesNotThrow(()=>validateTarget(TEST_ID));
  for(const id of [ORIGINAL_ID,undefined,'otro',''])assert.throws(()=>validateTarget(id));
});
test('bloquea cualquier escritura de Calendar y de la aplicación',()=>{
  for(const method of ['insert','update','delete','patch','batchUpdate'])assert.throws(()=>validateOperation('calendar',method,{calendarId:'primary'}));
  for(const method of ['append','update','batchUpdate'])assert.throws(()=>validateOperation('sheets',method,{spreadsheetId:TEST_ID,range:'Detalle!A1'}));
});
test('configuración y HTML servidos no apuntan al proxy de producción',()=>{
  const config=vm.runInNewContext(testConfig('http://localhost:3000')+';CONFIG');
  assert.equal(config.SPREADSHEET_ID,TEST_ID);
  assert.equal(config.GOOGLE_SHEETS_API_URL,'http://localhost:3000/api/sheets');
  assert.match(config.SCOPES,/calendar.events.readonly/);
  assert(!config.SCOPES.includes('calendar.events '));
  const html=testPage();
  assert(!html.includes("getItem('g_token')"));
  assert(!html.includes('config.secure.js'));
  assert.match(html,/actualizarRealizadosFlag = false/);
  assert.match(html,/CONFIG.TEST_MODE && resolverCal/);
  assert.match(html,/sandbox\/panel.js/);
  for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});
test('prueba de escritura usa solo la copia y retira la pestaña temporal',async()=>{
  const calls=[];
  const upstream=async(url,options)=>{
    calls.push({url,options});
    assert(url.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`));
    let data={};
    if(calls.length===1)data={replies:[{addSheet:{properties:{sheetId:77}}}]};
    if(calls.length===3)data={values:[[42]]};
    return {ok:true,status:200,text:async()=>JSON.stringify(data)};
  };
  const result=await controlProbe('Bearer fake',upstream);
  assert.equal(result.restored,true);assert.equal(result.calendarModified,false);
  assert.equal(calls.length,4);
  assert.deepEqual(JSON.parse(calls[3].options.body),{requests:[{deleteSheet:{sheetId:77}}]});
});
test('restaura la pestaña temporal aunque falle la verificación',async()=>{
  const calls=[];
  const upstream=async(url,options)=>{
    calls.push({url,options});
    const data=calls.length===1?{replies:[{addSheet:{properties:{sheetId:78}}}]}:calls.length===3?{values:[[99]]}:{};
    return {ok:true,status:200,text:async()=>JSON.stringify(data)};
  };
  await assert.rejects(()=>controlProbe('Bearer fake',upstream),/no coincide/);
  assert.deepEqual(JSON.parse(calls[3].options.body),{requests:[{deleteSheet:{sheetId:78}}]});
});
test('el endpoint Vercel rechaza original y Calendar antes de autenticación o red',async()=>{
  async function call(api,body,method='POST',origin='https://javat93.github.io'){
    const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(body){this.body=body;return this},end(){return this}};
    await deployedHandler({method,query:{api},body,headers:{host:'horas-git-main-javat93s-projects.vercel.app',origin}},res);
    return res;
  }
  const state=await call('environment',null,'GET');
  assert.equal(state.body.spreadsheetId,TEST_ID);
  assert.equal(state.headers['Access-Control-Allow-Origin'],'https://javat93.github.io');
  assert.equal((await call('sheets',{method:'get',params:{spreadsheetId:ORIGINAL_ID,range:'Detalle!A1'}})).code,403);
  assert.equal((await call('sheets',{method:'update',params:{spreadsheetId:TEST_ID,range:'Detalle!A1'}})).code,403);
  assert.equal((await call('calendar',{method:'delete',params:{calendarId:'primary',eventId:'personal'}})).code,403);
  assert.equal((await call('control',{spreadsheetId:ORIGINAL_ID})).code,403);
  assert.equal((await call('groups',{spreadsheetId:ORIGINAL_ID,action:'apply'})).code,403);
  assert.equal((await call('groups',{spreadsheetId:TEST_ID,action:'audit'})).code,401);
  assert.equal((await call('sheets',{method:'get',params:{spreadsheetId:TEST_ID,range:'Detalle!A1'}})).code,401);
  assert.equal((await call('environment',null,'GET','https://ajeno.example')).code,403);
});
test('HTTP bloquea el original, Calendar y archivos sensibles antes de llamar a Google',async t=>{
  let calls=0;
  const server=createServer(async()=>{calls++;return{ok:true,status:200,text:async()=>'{"values":[["copiado"]]}'}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={'Content-Type':'application/json',Authorization:'Bearer fake'};
  for(const [api,payload]of[
    ['sheets',{method:'update',params:{spreadsheetId:ORIGINAL_ID,range:'Detalle!A1'},body:{values:[[1]]}}],
    ['sheets',{method:'get',params:{spreadsheetId:ORIGINAL_ID,range:'Detalle!A1'}}],
    ['calendar',{method:'delete',params:{calendarId:'primary',eventId:'personal'}}],
    ['calendar',{method:'insert',params:{calendarId:'primary'}}],
    ['test-control',{spreadsheetId:ORIGINAL_ID}],
  ]){const r=await fetch(`${base}/api/${api}`,{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(r.status,403);}
  for(const name of ['config.secure.js','.env','api/proxy.js.bak','sandbox/server.cjs']){
    const r=await fetch(`${base}/${name}`);assert.equal(r.status,404);
  }
  assert.equal(calls,0);
  const env=await(await fetch(`${base}/api/test-environment`)).json();
  assert.equal(env.spreadsheetId,TEST_ID);assert.equal(env.calendarReadOnly,true);assert.equal(env.automaticWrites,true);assert.equal(env.performedAutomation,true);
  const unauth=await fetch(`${base}/api/sheets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'get',params:{spreadsheetId:TEST_ID,range:'Detalle!A1'}})});
  assert.equal(unauth.status,401);assert.equal(calls,0);
  const read=await fetch(`${base}/api/sheets`,{method:'POST',headers,body:JSON.stringify({method:'get',params:{spreadsheetId:TEST_ID,range:'Detalle!A1'}})});
  assert.equal(read.status,200);assert.equal(calls,1);
  const foreign=await fetch(`${base}/api/test-environment`,{headers:{Origin:'https://ajeno.example'}});
  assert.equal(foreign.status,403);
});
