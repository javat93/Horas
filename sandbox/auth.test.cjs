const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../auth-session.js');
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
test('caducidad real de Google, reutilización y limpieza sin inventar renovación',()=>{
  const s=storage();let now=1000;const auth=A.create(s,'test',()=>now);auth.save({access_token:'fake',expires_in:3600});assert.equal(auth.read().expiresAt,3601000);assert.equal(auth.read().expired,false);
  now=3571000;assert.equal(auth.read().expired,true);auth.clear();assert.equal(auth.read().token,'');assert.throws(()=>auth.save({access_token:'fake'}));
});
test('sesión anterior sin caducidad se valida sin cerrarla al desplegar; entornos aislados',()=>{
  const s=storage();s.setItem('pruebas','legacy');assert.equal(A.create(s,'pruebas').read().expired,false);assert.equal(A.create(s,'real').read().token,'');
});
test('no fuerza consentimiento ni confunde un error de red o cuota con sesión inválida',()=>{
  assert.deepEqual(A.requestOptions(),{prompt:''});for(const error of [{status:401},{message:'Google 401: Unauthorized'},{message:'invalid authentication credentials'}])assert.equal(A.isAuthError(error),true);
  for(const error of [{status:403,message:'quota exceeded'},{status:500},{message:'Failed to fetch'}])assert.equal(A.isAuthError(error),false);
});
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function harness({granted=true,error}={}){
  const s=storage(),elements={},requests=[],syncs=[],errors=[];let token=null;
  for(const id of ['auth-btn','review-google-permissions','sync-btn','add-future-events-btn','auth-text','auth-status'])elements[id]={classList:{toggle(){},add(){},remove(){}}};
  const client={requestAccessToken:options=>requests.push(options)},window={};
  const context=vm.createContext({window,AppData:require('../app-data.js'),AuthSession:A,localStorage:s,CONFIG:{TEST_MODE:true,SCOPES:'scope1 scope2'},document:{getElementById:id=>elements[id]},gapi:{client:{getToken:()=>token,setToken:v=>token=v}},google:{accounts:{oauth2:{hasGrantedAllScopes:()=>granted}}},showLoading(){},hideLoading(){},showErrorModal:(...args)=>errors.push(args),syncData:async(...args)=>{syncs.push(args);if(error)throw error;},fetch:async()=>{throw Error('No real network');},console});
  const state=html.slice(html.indexOf('        let tokenClient;'),html.indexOf('        let eventos = []'));
  const funcs=html.slice(html.indexOf('        async function handleAuthClick('),html.indexOf('        // Función para asegurar que el botón de auth'));
  context.client=client;vm.runInContext(state+funcs+';gapiInited=gisInited=true;tokenClient=client;',context);
  return {context,window,s,elements,requests,syncs,errors,client,getToken:()=>token};
}
test('conectar obtiene nuevo token para gapi y caché, registra caducidad y solo lee datos',async()=>{
  const h=harness();await h.context.handleAuthClick();await h.context.handleAuthClick();assert.equal(h.requests.length,1);assert.equal(h.requests[0].prompt,'');
  await h.client.callback({access_token:'renewed',expires_in:3600});assert.equal(h.getToken().access_token,'renewed');assert.equal(h.s.getItem('g_token_pruebas'),'renewed');assert(Number(h.s.getItem('g_token_pruebas_expires_at'))>Date.now());assert.deepEqual(h.syncs,[[false,false]]);
});
test('revisión explícita muestra consentimiento sin revocar la sesión ni duplicar solicitudes',async()=>{
  const h=harness();A.create(h.s,'g_token_pruebas').save({access_token:'existing',expires_in:3600});
  await h.context.handleAuthClick(true);await h.context.handleAuthClick(true);
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].prompt,'consent');
  assert.equal(h.s.getItem('g_token_pruebas'),'existing');assert.equal(h.elements['review-google-permissions'].disabled,true);
  await h.client.callback({error:'access_denied'});
  assert.equal(h.s.getItem('g_token_pruebas'),'existing');assert.equal(h.syncs.length,0);assert.equal(h.elements['review-google-permissions'].disabled,false);
  await h.context.handleAuthClick();assert.equal(h.requests[1].prompt,'');
  assert.deepEqual(A.requestOptions('true'),{prompt:''});
});
test('permiso incompleto no se presenta como conectado ni inicia consultas',async()=>{
  const h=harness({granted:false});await h.context.handleAuthClick();await h.client.callback({access_token:'partial',expires_in:3600});assert.equal(h.s.getItem('g_token_pruebas'),null);assert.equal(h.syncs.length,0);assert.equal(h.errors.length,1);
});
test('recargar reutiliza sesión una vez; fallo de red no borra autorización',async()=>{
  const h=harness({error:new Error('Failed to fetch')});A.create(h.s,'g_token_pruebas').save({access_token:'cached',expires_in:3600});h.context.checkAuth();h.context.checkAuth();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.syncs.length,1);assert.equal(h.s.getItem('g_token_pruebas'),'cached');assert.equal(h.requests.length,0);
});
test('token renovado en otra pestaña reemplaza el antiguo y uno caducado no se envía',()=>{
  const h=harness();A.create(h.s,'g_token_pruebas').save({access_token:'other-tab',expires_in:3600});assert.equal(h.window.horasAccessToken(),'other-tab');assert.equal(h.getToken().access_token,'other-tab');
  h.s.setItem('g_token_pruebas_expires_at','1');assert.throws(()=>h.window.horasAccessToken(),/Renueva/);assert.equal(h.s.getItem('g_token_pruebas'),null);assert.equal(h.getToken(),null);assert.equal(h.requests.length,0);
});
test('respuesta de sesión inválida pide renovar sin repetir operaciones; errores de cuota conservan sesión',async()=>{
  const h=harness();let calls=0;A.create(h.s,'g_token_pruebas').save({access_token:'cached',expires_in:3600});
  h.context.fetch=async()=>{calls++;return {ok:false,status:403,clone:()=>({json:async()=>({error:'Quota exceeded'})})};};await h.window.horasFetch('https://example.invalid',{});assert.equal(h.s.getItem('g_token_pruebas'),'cached');assert.equal(calls,1);
  h.context.fetch=async()=>{calls++;return {ok:false,status:502,clone:()=>({json:async()=>({error:'Google 401: Invalid Credentials'})})};};await h.window.horasFetch('https://example.invalid',{});assert.equal(h.s.getItem('g_token_pruebas'),null);assert.equal(calls,2);assert.equal(h.requests.length,0);
});
