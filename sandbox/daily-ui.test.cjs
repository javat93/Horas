const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('nueva sesión y nuevo grupo reactivan los campos bloqueados por una edición anterior; fecha de Madrid',()=>{
  const elements={};const element=id=>elements[id]||=( {disabled:true,hidden:true,value:'anterior',textContent:'anterior',classList:{add(){},remove(){}},reset(){}} );
  class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-01T23:30:00Z']));}}
  const context={document:{getElementById:element},Date:Clock,Intl,refreshGroupLabels(){},autoFillGrupo(){},openModal(){}};
  vm.runInNewContext(html.slice(html.indexOf('        function openNewSesionModal()'),html.indexOf('        function openEditSesionModal('))+html.slice(html.indexOf('        function openNewGrupoModal()'),html.indexOf('        function openEditGrupoModal('))+';openNewSesionModal();openNewGrupoModal();',context);
  for(const id of ['ev-fecha','ev-grupo','ev-grupo-search','ev-bolo','ev-sitio','ev-repite','ev-freq','ev-interval','ev-until','gr-nombre','gr-sitio'])assert.equal(elements[id].disabled,false,id);
  assert.equal(elements['ev-fecha'].value,'2026-11-02');assert.equal(elements['protected-session-fields'].hidden,false);assert.equal(elements['ev-total'].value,'');
});
test('formularios de altas y borrado pasan por revisión y no alcanzan las operaciones antiguas',async()=>{
  const elements={},calls=[],handlers={};let domReady;
  const element=id=>elements[id]||={value:'',style:{},classList:{},addEventListener(type,fn){handlers[id+':'+type]=fn;}};
  const window={horasConfigReady:Promise.resolve(),reviewNewSessionForm:async()=>calls.push('session'),reviewNewGroupForm:async()=>calls.push('group'),reviewFutureImport:async()=>calls.push('import'),reviewDeleteSession:async row=>calls.push(['delete',row])};
  const env={mode:'test',phase:8,spreadsheetId:'copy',calendarReadOnly:true,automaticWrites:true,appWrites:false,stateReview:true,performedAutomation:true,addressReview:true,identityReview:true,groupReview:true,protectedReview:true,localeReview:true,dailyOperations:true};
  const context={window,document:{getElementById:element,addEventListener(type,fn){if(type==='DOMContentLoaded')domReady=fn;else handlers['document:'+type]=fn;}},CONFIG:{TEST_MODE:true,TEST_PHASE:8,SPREADSHEET_ID:'copy',DAILY_API_URL:'/daily'},fetch:async()=>({ok:true,json:async()=>env}),setTimeout(){},syncData(){},showErrorModal(){assert.fail('No debe fallar');}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'panel.js'),'utf8'),context);await domReady();assert.equal(window.horasDailyReady,true);
  for(const id of ['form-evento','form-grupo','form-future-events']){let stopped=false;handlers[id+':submit']({preventDefault(){},stopImmediatePropagation(){stopped=true;}});assert(stopped);}
  handlers['document:click']({target:{closest:()=>({getAttribute:()=> 'confirmarBorrar(1494)'})},preventDefault(){},stopImmediatePropagation(){}});
  assert.equal(JSON.stringify(calls),JSON.stringify(['session','group','import',['delete',1494]]));
});
