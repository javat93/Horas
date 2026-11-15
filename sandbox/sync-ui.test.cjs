const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
for(const scenario of [
  {name:'sincronizar ofrece incorporar eventos nuevos aunque no haya cambios en las filas existentes',plan:{summary:[{group:'Cole',date:'2026-11-04',start:'18:00',end:'19:00',total:20}],skipped:[]},button:'Revisar incorporación de 1 sesión',status:'1 sesión nueva de Calendar.'},
  {name:'sincronizar ofrece retirar sesiones eliminadas aunque no haya altas ni cambios de precio',plan:{summary:[],moves:[],removals:[{rowIdx:2,group:'Cole',date:'2026-11-04',start:'18:00',end:'19:00'}],skipped:[]},button:'Revisar sincronización de Calendar',status:'1 sesión para retirar.'}
])test(scenario.name,async()=>{
  const nodes=[];function element(tag){const n={tag,style:{},children:[],textContent:'',append(...items){for(const item of items){item.parent=this;this.children.push(item);}},setAttribute(k,v){this[k]=v;},focus(){},querySelectorAll(){return [];},addEventListener(){},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}};nodes.push(n);return n;}
  const body=element('body'),host=element('div'),calls=[];
  const document={body,createElement:element,getElementById:id=>nodes.find(n=>n.id===id)};
  const window={horasEnvironmentReady:Promise.resolve(true),horasAccessToken:()=> 'synthetic',horasFetch:async()=>({ok:true,json:async()=>({plans:[],catalogVersion:'catalog'})}),previewCalendarImport:async month=>{calls.push(['scan',month]);return scenario.plan;},reviewCalendarImport:async month=>calls.push(['review',month])};
  vm.runInNewContext(fs.readFileSync(require.resolve('./protected-editor.js'),'utf8'),{window,document,CONFIG:{DATA_MODE:'test',PROTECTED_REVIEW_API_URL:'/fake',SPREADSHEET_ID:'fixture'},Intl,Date,closeModal(){},showErrorModal(...args){assert.fail(JSON.stringify(args));}});
  window.mountProtectedReview(host);document.getElementById('protected-sync-month').value='2026-11';await window.prepareProtectedSync();
  const add=nodes.find(n=>n.tag==='button'&&n.textContent===scenario.button);assert(add);
  assert(nodes.some(n=>n.textContent.includes(scenario.status)));
  assert.equal(nodes.find(n=>n.tag==='button'&&n.textContent==='Guardar cambios en sesiones existentes').disabled,true);
  await add.onclick();assert.deepEqual(calls,[['scan','2026-11'],['review','2026-11']]);assert.equal(document.getElementById('protected-review-dialog').parent.children.includes(document.getElementById('protected-review-dialog')),false);
});

test('la revisión muestra solo los campos modificados y se cierra mientras guarda',async()=>{
  const nodes=[];function element(tag){const n={tag,style:{},children:[],textContent:'',append(...items){for(const item of items){item.parent=this;this.children.push(item);}},setAttribute(k,v){this[k]=v;},focus(){},querySelectorAll(){return [];},addEventListener(){},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}};nodes.push(n);return n;}
  const body=element('body'),host=element('div'),result=element('p');result.id='test-result';body.append(result);
  const document={body,createElement:element,getElementById:id=>nodes.find(n=>n.id===id)};
  const review={catalogVersion:'catalog',plans:[{rowIdx:7,group:'Cole',date:'2026-11-04',source:'Calendar',expectedVersion:'row',proposalVersion:'proposal',diff:{money:false,district:false,address:true,time:false},current:{price:20,total:20,district:'Centro',address:'Calle Mayor',start:'18:00',end:'19:00'},proposal:{money:null,district:'Centro',address:'Calle Mayor 12',time:null},notes:[]}]};
  let calls=0,finishApply;const applyGate=new Promise(resolve=>finishApply=resolve);
  const window={horasEnvironmentReady:Promise.resolve(true),horasWritesEnabled:true,horasAccessToken:()=> 'synthetic',horasFetch:async()=>{calls++;if(calls===1)return {ok:true,json:async()=>review};await applyGate;return {ok:true,json:async()=>({unchanged:true,rowsChanged:0,cellsChanged:0})};},previewCalendarImport:async()=>({summary:[],moves:[],removals:[],skipped:[]})};
  vm.runInNewContext(fs.readFileSync(require.resolve('./protected-editor.js'),'utf8'),{window,document,CONFIG:{DATA_MODE:'test',PROTECTED_REVIEW_API_URL:'/fake',SPREADSHEET_ID:'fixture'},Intl,Date,closeModal(){},syncData(){assert.fail('No debe recargar si no cambia ninguna celda.');},showErrorModal(...args){assert.fail(JSON.stringify(args));}});
  window.mountProtectedReview(host);document.getElementById('protected-sync-month').value='2026-11';await window.prepareProtectedSync();
  assert(nodes.some(n=>n.textContent.startsWith('Dirección de esta sesión: actual Calle Mayor')));
  assert(!nodes.some(n=>n.textContent.startsWith('Precio e importe por sesión:')));
  assert(!nodes.some(n=>n.textContent.startsWith('Barrio: actual')));
  assert(!nodes.some(n=>n.textContent.startsWith('Horario de la sesión:')));
  const overlay=document.getElementById('protected-review-dialog'),save=nodes.find(n=>n.tag==='button'&&n.textContent==='Guardar cambios en sesiones existentes');assert.equal(save.disabled,undefined);
  const pending=save.onclick();assert(!overlay.parent.children.includes(overlay));assert.equal(result.textContent,'Guardando los cambios...');
  finishApply();await pending;assert.equal(result.textContent,'Se ha conservado todo. Ninguna celda modificada.');
});
