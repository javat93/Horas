const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../protected-review.js');
const {runProtected}=require('./protected-service.cjs');
const {TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function cell(value,formatted){const key=typeof value==='number'?'numberValue':'stringValue';return {userEnteredValue:{[key]:value},effectiveValue:{[key]:value},formattedValue:formatted??String(value)};}
function fixture(options={}){
  const row=Array.from({length:14},()=>({}));
  row[0]=cell('X');row[1]=cell('X');row[3]=cell('X');row[4]=cell(37.5);row[5]=cell(46293,'28/09/2026');row[6]=cell(39.5,'39,50 €');row[7]=cell(1);row[8]=cell('Prueba');row[9]=cell('Barrio del bolo');row[10]=cell('work');row[11]=cell('Dirección particular');row[12]=cell(18/24,'18:00');row[13]=cell(19/24,'19:00');
  if(options.formula)row[6]={userEnteredValue:{formulaValue:options.formula},effectiveValue:{numberValue:37.5},formattedValue:'37,50 €'};
  const state={rows:[Array.from({length:14},()=>({})),row],groups:[[cell('Grupo'),cell('Dirección'),cell('Precio'),cell('Bolo'),cell('Barrio')],[cell('Prueba'),cell('Dirección del catálogo'),cell(20),cell(50),cell(options.blankDistrict?'':'Barrio del catálogo')]],calls:[],snapshots:0};
  const event={id:'work',summary:'Prueba',colorId:'5',status:'confirmed',start:{dateTime:'2026-09-28T18:30:00+02:00'},end:{dateTime:'2026-09-28T20:00:00+02:00'}};
  state.request=async(url,token,method='GET',body)=>{
    state.calls.push({url,method,body:clone(body||null)});
    if(url.includes('calendar')){assert.equal(method,'GET');return {items:[event]};}
    assert(url.includes(TEST_ID));assert(!url.includes(ORIGINAL_ID));
    if(method==='POST'){
      assert(url.endsWith(':batchUpdate'));
      for(const request of body.requests){const update=request.updateCells;assert.equal(update.range.sheetId,0);assert.equal(update.range.endRowIndex,update.range.startRowIndex+1);assert.equal(update.range.endColumnIndex,update.range.startColumnIndex+1);assert([4,6,9,12,13].includes(update.range.startColumnIndex));
        const target=state.rows[update.range.startRowIndex][update.range.startColumnIndex],value=update.rows[0].values[0].userEnteredValue;target.userEnteredValue=clone(value);target.effectiveValue=clone(value);target.formattedValue=String(value.numberValue??value.stringValue??'');}
      return {};
    }
    state.snapshots++;options.beforeSnapshot?.(state,state.snapshots);
    return clone({sheets:[{properties:{title:'Detalle'},data:[{startRow:0,rowData:state.rows.map(values=>({values}))}]},{properties:{title:'Coles'},data:[{startRow:0,rowData:state.groups.map(values=>({values}))}]}]});
  };
  return state;
}
const sync={spreadsheetId:TEST_ID,action:'preview',mode:'sync',month:'2026-09'};
function apply(review,choices,extra={}){return {...sync,action:'apply',catalogVersion:review.catalogVersion,decisions:review.plans.map(plan=>({rowIdx:plan.rowIdx,expectedVersion:plan.expectedVersion,proposalVersion:plan.proposalVersion,choices:{money:'keep',district:'keep',time:'keep',...choices}})),...extra};}
const writes=f=>f.calls.filter(c=>c.method!=='GET');
test('importes españoles y equivalencias, sin adivinar separadores ambiguos',()=>{
  for(const value of [37.5,'37,50 €','37.50'])assert.equal(P.number(value),37.5);
  assert.equal(P.number('1.234,56'),1234.56);
  for(const value of ['1.234','',null,-1,Infinity,'2,3,4'])assert.throws(()=>P.number(value));
  const f=fixture(),plan=P.makePlan(2,f.rows[1],{money:{price:37.5,total:39.5},district:' barrio del bolo ',time:{start:'18:00',end:'19:00'}},'Prueba');assert.deepEqual(plan.diff,{money:false,district:false,time:false});
});
test('preparar sincronización solo lee y muestra diferencias de precio, barrio y horario',async()=>{
  const f=fixture(),review=await runProtected(sync,'Bearer fake',f.request),plan=review.plans[0];
  assert.deepEqual(plan.diff,{money:true,district:true,time:true});assert.equal(plan.current.total,39.5);assert.deepEqual(plan.proposal.money,{price:20,total:20});assert.equal(writes(f).length,0);
});
test('conservar todo no escribe y respeta fórmulas y excepciones',async()=>{
  const f=fixture({formula:'=E2*H2'}),before=clone(f.rows[1]);const review=await runProtected(sync,'Bearer fake',f.request);
  const result=await runProtected(apply(review,{}),'Bearer fake',f.request);assert.equal(result.unchanged,true);assert.equal(writes(f).length,0);assert.deepEqual(f.rows[1],before);
});
test('aceptar solo horario conserva precio especial, importe, fórmula, barrio y H=1',async()=>{
  const f=fixture({formula:'=E2*H2'}),review=await runProtected(sync,'Bearer fake',f.request);
  await runProtected(apply(review,{time:'use'}),'Bearer fake',f.request);
  const columns=writes(f)[0].body.requests.map(r=>r.updateCells.range.startColumnIndex);assert.deepEqual(columns,[12,13]);assert.equal(f.rows[1][4].effectiveValue.numberValue,37.5);assert.equal(f.rows[1][6].userEnteredValue.formulaValue,'=E2*H2');assert.equal(f.rows[1][7].effectiveValue.numberValue,1);assert.equal(f.rows[1][9].formattedValue,'Barrio del bolo');
});
test('aceptar precio fija importes numéricos por sesión sin multiplicar por duración',async()=>{
  const f=fixture(),review=await runProtected(sync,'Bearer fake',f.request);await runProtected(apply(review,{money:'use',time:'use'}),'Bearer fake',f.request);
  assert.equal(f.rows[1][4].userEnteredValue.numberValue,20);assert.equal(f.rows[1][6].userEnteredValue.numberValue,20);assert.equal(f.rows[1][7].effectiveValue.numberValue,1);
});
test('barrio manual se conserva o cambia solo con decisión específica; un vacío no lo borra',async()=>{
  const f=fixture(),review=await runProtected(sync,'Bearer fake',f.request);await runProtected(apply(review,{district:'use'}),'Bearer fake',f.request);
  assert.deepEqual(writes(f)[0].body.requests.map(r=>r.updateCells.range.startColumnIndex),[9]);assert.equal(f.rows[1][9].userEnteredValue.stringValue,'Barrio del catálogo');assert.equal(f.rows[1][4].effectiveValue.numberValue,37.5);
  const b=fixture({blankDistrict:true}),preview=await runProtected(sync,'Bearer fake',b.request);assert.equal(preview.plans[0].proposal.district,null);await runProtected(apply(preview,{district:'use'}),'Bearer fake',b.request);assert.equal(writes(b).length,0);assert.equal(b.rows[1][9].formattedValue,'Barrio del bolo');
});
test('el formulario compara contra la hoja recién leída, permite excepciones y no toca Calendar',async()=>{
  const f=fixture(),payload={spreadsheetId:TEST_ID,mode:'edit',rowIdx:2,proposal:{price:'45,25',total:'47,75',district:'Barrio especial'}};
  const review=await runProtected({...payload,action:'preview'},'Bearer fake',f.request);const decision=apply(review,{money:'use',district:'use'}).decisions;
  await runProtected({...payload,action:'apply',decisions:decision},'Bearer fake',f.request);
  assert.equal(f.rows[1][4].effectiveValue.numberValue,45.25);assert.equal(f.rows[1][6].effectiveValue.numberValue,47.75);assert.equal(f.rows[1][9].formattedValue,'Barrio especial');assert(!f.calls.some(c=>c.url.includes('calendar')));
});
test('un cambio manual desde preview o durante confirmación bloquea todo el lote',async()=>{
  for(const at of [2,3]){const f=fixture({beforeSnapshot:(state,n)=>{if(n===at)state.rows[1][9]=cell('Editado directamente en Sheets');}});const review=await runProtected(sync,'Bearer fake',f.request);await assert.rejects(()=>runProtected(apply(review,{money:'use'}),'Bearer fake',f.request),/cambió|editó/);assert.equal(writes(f).length,0);}
});
test('una tarifa de catálogo cambiada entre preview y confirmación no se acepta silenciosamente',async()=>{
  const f=fixture({beforeSnapshot:(state,n)=>{if(n===2)state.groups[1][2]=cell(99);}});const review=await runProtected(sync,'Bearer fake',f.request);await assert.rejects(()=>runProtected(apply(review,{money:'use'}),'Bearer fake',f.request),/catálogo cambió/);assert.equal(writes(f).length,0);
});
test('sin tarifa o vínculo único no inventa precios ni modifica Calendar',async()=>{
  const f=fixture();f.groups[1][2]={};f.rows.push(clone(f.rows[1]));const review=await runProtected(sync,'Bearer fake',f.request);assert.equal(review.plans[0].proposal.money,null);assert.equal(review.plans[0].proposal.time,null);assert(review.plans[0].notes.some(n=>n.includes('compartido')));assert.equal(writes(f).length,0);
});
test('se bloquean decisiones inexistentes, columnas extra y un destino original antes de escribir',async()=>{
  const f=fixture();await assert.rejects(()=>runProtected({...sync,spreadsheetId:ORIGINAL_ID},'Bearer fake',f.request));assert.equal(f.calls.length,0);
  await assert.rejects(()=>runProtected({...sync,mode:'edit',rowIdx:2,proposal:{price:20,total:20,horas:9}},'Bearer fake',f.request),/solo permite/);
  const review=await runProtected(sync,'Bearer fake',f.request);const bad=apply(review,{money:'use',hours:'use'});await assert.rejects(()=>runProtected(bad,'Bearer fake',f.request),/no válidas/);assert.equal(writes(f).length,0);
});
test('una fórmula dependiente de horario no cambia su importe implícitamente',async()=>{
  const f=fixture({formula:'=E2*(N2-M2)*24'}),review=await runProtected(sync,'Bearer fake',f.request);await assert.rejects(()=>runProtected(apply(review,{time:'use'}),'Bearer fake',f.request),/fórmula/);assert.equal(writes(f).length,0);
});
