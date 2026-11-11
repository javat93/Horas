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

test('editar muestra solo los datos modificados y cierra ambos diálogos al confirmar',async()=>{
  const nodes=[],elements={};function createElement(tag){const n={tag,style:{},children:[],textContent:'',append(...items){for(const item of items){item.parent=this;this.children.push(item);}},setAttribute(k,v){this[k]=v;},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}};nodes.push(n);return n;}
  const body=createElement('body'),result=createElement('p');result.id='test-result';body.append(result);
  const values={'ev-rowIdx':'7','ev-grupo':'Cole','ev-fecha':'2026-11-04','ev-hora-inicio':'18:00','ev-hora-fin':'19:00','ev-precio':'20','ev-total':'20','ev-barrio':'Centro','ev-sitio':'Calle Mayor 12'};
  for(const [id,value]of Object.entries(values)){const input=createElement('input');input.id=id;input.value=value;elements[id]=input;}for(const [id,checked]of [['ev-bolo',false],['ev-calendar',false]]){const input=createElement('input');input.id=id;input.checked=checked;elements[id]=input;}
  const document={body,createElement,getElementById:id=>elements[id]||nodes.find(n=>n.id===id)};
  const proposed={group:'Cole',date:'2026-11-04',start:'18:00',end:'19:00',price:20,total:20,district:'Centro',address:'Calle Mayor 12',gig:false};
  let calls=0,finishApply;const gate=new Promise(resolve=>finishApply=resolve),closed=[];
  const window={horasEnvironmentReady:Promise.resolve(true),horasDailyReady:true,horasWritesEnabled:true,horasAccessToken:()=> 'synthetic',horasFetch:async()=>{calls++;if(calls===1)return {ok:true,json:async()=>({summary:[proposed],calendarActions:[],warnings:[],skipped:[],duplicates:0,version:'review'})};await gate;return {ok:true,json:async()=>({unchanged:true})};}};
  const LocaleData={numeric:value=>value===''||value===null||value===undefined?null:Number(value),currency:value=>`${Number(value).toFixed(2)} €`,display:value=>value==='2026-11-04'?'04/11/2026':value,parseSpanish:value=>value==='04/11/2026'?'2026-11-04':''};
  const GroupIdentity={id:value=>String(value||'').toLowerCase(),same:(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(),label:value=>value,catalogLabel:value=>value};
  const CalendarLinking={time:value=>String(value||'')};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'daily-editor.js'),'utf8'),{window,document,CONFIG:{DAILY_API_URL:'/fake',SPREADSHEET_ID:'fixture',SPREADSHEET_NAME:'Horas'},crypto:{randomUUID:()=> 'operation'},eventos:[{rowIdx:7,boloCole:'',precioHora:20,fechaStr:'04/11/2026',fechaObj:new Date(2026,10,4),total:20,grupo:'Cole',sitio:'Centro',direccion:'Calle Mayor',horaInicio:'18:00',horaFin:'19:00'}],LocaleData,GroupIdentity,CalendarLinking,closeModal:id=>closed.push(id),async syncData(){},showErrorModal(...args){assert.fail(JSON.stringify(args));}});
  await window.reviewCalendarSessionForm();
  assert(nodes.some(n=>n.textContent==='Dirección: Calle Mayor → Calle Mayor 12'));
  for(const label of ['Tipo:','Grupo:','Fecha:','Horario:','Precio:','Importe total:','Barrio:'])assert(!nodes.some(n=>n.textContent.startsWith(label)),label);
  const dialog=nodes.find(n=>n.tag==='dialog'&&n.open),save=nodes.find(n=>n.tag==='button'&&n.textContent==='Confirmar en la hoja seleccionada');
  const pending=save.onclick();assert(!dialog.parent.children.includes(dialog));assert.deepEqual(closed,['modal-evento']);assert.equal(result.textContent,'Guardando los cambios…');
  finishApply();await pending;assert.equal(result.textContent,'No hay cambios que guardar.');
});
