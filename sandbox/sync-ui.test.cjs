const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('sincronizar ofrece incorporar eventos nuevos aunque no haya cambios en las filas existentes',async()=>{
  const nodes=[];function element(tag){const n={tag,style:{},children:[],textContent:'',append(...items){for(const item of items){item.parent=this;this.children.push(item);}},setAttribute(k,v){this[k]=v;},focus(){},querySelectorAll(){return [];},addEventListener(){},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}};nodes.push(n);return n;}
  const body=element('body'),host=element('div'),calls=[];
  const document={body,createElement:element,getElementById:id=>nodes.find(n=>n.id===id)};
  const window={horasEnvironmentReady:Promise.resolve(true),horasAccessToken:()=> 'synthetic',horasFetch:async()=>({ok:true,json:async()=>({plans:[],catalogVersion:'catalog'})}),previewCalendarImport:async month=>{calls.push(['scan',month]);return {summary:[{group:'Cole',date:'2026-11-04',start:'18:00',end:'19:00',total:20}],skipped:[]};},reviewCalendarImport:async month=>calls.push(['review',month])};
  vm.runInNewContext(fs.readFileSync(require.resolve('./protected-editor.js'),'utf8'),{window,document,CONFIG:{DATA_MODE:'test',PROTECTED_REVIEW_API_URL:'/fake',SPREADSHEET_ID:'fixture'},Intl,Date,closeModal(){},showErrorModal(...args){assert.fail(JSON.stringify(args));}});
  window.mountProtectedReview(host);document.getElementById('protected-sync-month').value='2026-11';await window.prepareProtectedSync();
  const add=nodes.find(n=>n.tag==='button'&&n.textContent==='Revisar incorporación de 1 sesión');assert(add);
  assert(nodes.some(n=>n.textContent.includes('1 sesión nueva de Calendar.')));
  assert.equal(nodes.find(n=>n.tag==='button'&&n.textContent==='Guardar cambios en sesiones existentes').disabled,true);
  await add.onclick();assert.deepEqual(calls,[['scan','2026-11'],['review','2026-11']]);assert.equal(document.getElementById('protected-review-dialog').parent.children.includes(document.getElementById('protected-review-dialog')),false);
});
