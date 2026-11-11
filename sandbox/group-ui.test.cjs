const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

test('grupo muestra solo los campos modificados y cierra los diálogos mientras guarda',async()=>{
  const nodes=[],elements={};function createElement(tag){const n={tag,style:{},children:[],textContent:'',append(...items){for(const item of items){item.parent=this;this.children.push(item);}},setAttribute(k,v){this[k]=v;},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}};nodes.push(n);return n;}
  const body=createElement('body'),result=createElement('p');result.id='test-result';body.append(result);
  for(const [id,value]of Object.entries({'gr-rowIdx':'3','gr-precio':'20','gr-precio-bolo':'80','gr-ubicacion':'Centro','gr-sitio':'Calle Mayor 12'})){const input=createElement('input');input.id=id;input.value=value;elements[id]=input;}
  const document={body,createElement,getElementById:id=>elements[id]||nodes.find(n=>n.id===id)};
  const preview={name:'Cole',current:{price:20,gigPrice:80,location:'Centro',address:'Calle Mayor'},proposal:{price:20,gigPrice:80,location:'Centro',address:'Calle Mayor 12'},diff:{price:false,gigPrice:false,location:false,address:true},expectedVersion:'review'};
  let calls=0,finishApply;const gate=new Promise(resolve=>finishApply=resolve),closed=[];
  const window={horasEnvironmentReady:Promise.resolve(true),horasAccessToken:()=> 'synthetic',horasFetch:async()=>{calls++;if(calls===1)return {ok:true,json:async()=>preview};await gate;return {ok:true,json:async()=>({unchanged:true,cellsChanged:0})};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./group-editor.js'),'utf8'),{window,document,CONFIG:{GROUPS_API_URL:'/fake',SPREADSHEET_ID:'fixture',TEST_PHASE:7},LocaleData:{currency:value=>`${value} €`},closeModal:id=>closed.push(id),async syncData(){assert.fail('No debe recargar si no cambia ninguna celda.');},showErrorModal(...args){assert.fail(JSON.stringify(args));}});
  await window.reviewGroupForm();
  assert(nodes.some(n=>n.textContent==='Dirección habitual: actual Calle Mayor → propuesta Calle Mayor 12'));
  for(const label of ['Precio de sesión: actual','Precio Bolo: actual','Barrio/Ubicación: actual'])assert(!nodes.some(n=>n.textContent.startsWith(label)),label);
  const dialog=nodes.find(n=>n.tag==='dialog'&&n.open),save=nodes.find(n=>n.tag==='button'&&n.textContent==='Confirmar cambios del grupo en la hoja seleccionada');
  const pending=save.onclick();assert(!dialog.parent.children.includes(dialog));assert.deepEqual(closed,['modal-grupo']);assert.equal(result.textContent,'Guardando los cambios del grupo…');
  finishApply();await pending;assert.equal(result.textContent,'Se conserva todo. Ninguna celda modificada.');
});
