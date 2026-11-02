const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../protected-config.js');
const panel=fs.readFileSync(require.resolve('./panel.js'),'utf8'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');
async function mount(mode,overrides={}){
  const elements={},handlers={},mounted={},calls=[];let ready;
  const node=()=>({style:{},value:'',children:[],append(...items){this.children.push(...items);},addEventListener(type,fn){this.handlers??={};this.handlers[type]=fn;}});
  const element=id=>elements[id]||=(node());
  const config=C.create(mode),env={mode,spreadsheetId:config.SPREADSHEET_ID,protectedMode:true,writeEnabled:true,phase:8,calendarReadOnly:true,automaticWrites:true,appWrites:false,dailyOperations:true,stateReview:true,performedAutomation:true,addressReview:true,identityReview:true,groupReview:true,linkReview:true,protectedReview:true,localeReview:true,...overrides};
  const window={horasConfigReady:Promise.resolve(),reviewNewSessionForm:async()=>calls.push('new'),reviewNewGroupForm:async()=>calls.push('group'),reviewFutureImport:async()=>calls.push('import'),reviewDeleteSession:async row=>calls.push(['delete',row])};
  for(const [name,kind]of Object.entries({mountCalendarReview:'links',mountGroupReview:'groups',mountIdentityReview:'identity',mountLocaleReview:'locale',mountProtectedReview:'sync',mountDailyOperations:'daily'}))window[name]=target=>mounted[kind]=target;
  // Existing banner fixture lets us assert mount destinations independently of HTML parsing.
  element('test-environment-banner');
  const document={getElementById:element,createElement:node,addEventListener(type,fn){if(type==='DOMContentLoaded')ready=fn;else handlers[type]=fn;}};
  vm.runInNewContext(panel,{window,document,CONFIG:config,HorasProtectedConfig:C,fetch:async()=>({ok:true,json:async()=>env}),setTimeout(){},syncData(){},showErrorModal(){assert.fail('No debe abrir error');}});await ready();
  return {elements,handlers,mounted,calls,window};
}
for(const mode of ['rehearsal','production'])test(mode+': TEST_MODE=false conserva interceptores, papelera y sincronización; herramientas de auditoría plegadas',async()=>{
  const h=await mount(mode);assert.equal(await h.window.horasEnvironmentReady,true);assert.equal(h.window.horasDailyReady,true);assert.equal(h.window.horasWritesEnabled,true);
  assert.equal(h.mounted.sync,h.elements['test-environment-banner']);assert.equal(h.mounted.daily,h.mounted.sync);assert.notEqual(h.mounted.locale,h.mounted.sync);assert.equal(h.elements['test-control'].disabled,true);assert.equal(h.elements['sync-btn'].disabled,false);
  for(const id of ['form-evento','form-grupo','form-future-events']){let stopped=false;h.elements[id].handlers.submit({preventDefault(){},stopImmediatePropagation(){stopped=true;}});assert(stopped);}
  h.handlers.click({target:{closest:()=>({getAttribute:()=> 'confirmarBorrar(12)'})},preventDefault(){},stopImmediatePropagation(){}});
  assert.deepEqual(h.calls.slice(0,3),['new','group','import']);assert.equal(h.calls[3][1],12);
});
test('destino distinto o backend antiguo mantienen los cambios bloqueados',async()=>{
  for(const bad of [{mode:'test'},{spreadsheetId:'otro'},{protectedMode:false},{writeEnabled:undefined},{calendarReadOnly:false},{performedAutomation:false}]){const h=await mount('production',bad);assert.equal(await h.window.horasEnvironmentReady,false);assert.equal(h.window.horasWritesEnabled,false);assert.equal(h.mounted.daily,undefined);}
});
test('lectura inicial de producción permite consultar pero no activa escrituras automáticas',async()=>{
  const h=await mount('production',{writeEnabled:false,automaticWrites:false});assert.equal(await h.window.horasEnvironmentReady,true);assert.equal(h.window.horasWritesEnabled,false);assert.match(h.elements['test-target-status'].textContent,/solo lectura/);
});
test('proxy antiguo permanece bloqueado con TEST_MODE=false y sesión almacenada separada por entorno',async()=>{
  const code=html.slice(html.indexOf('        async function proxyGoogleAPI('),html.indexOf('        async function listAllCalendarEvents('));
  // Compile just this complete function, using its next known boundary in the source.
  const end=code.lastIndexOf('\n        }');
  const context=vm.createContext({CONFIG:C.create('production'),window:{horasEnvironmentReady:Promise.resolve(true)},Error});
  new vm.Script(code.slice(0,end+10));vm.runInContext(code.slice(0,end+10),context);
  await assert.rejects(vm.runInContext("proxyGoogleAPI('sheets','append',{spreadsheetId:CONFIG.SPREADSHEET_ID,range:'Detalle!A1'})",context),/protegida/);
  const key=html.slice(html.indexOf('        function tokenStorageKey()'),html.indexOf('        let gapiInited'));
  const keys=['production','rehearsal','test'].map(mode=>vm.runInNewContext(key+';tokenStorageKey();',{CONFIG:C.create(mode)}));assert.equal(new Set(keys).size,3);assert.equal(keys[2],'g_token_pruebas');
});
