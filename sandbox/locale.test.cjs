const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../locale-data.js');
const {runLocale,datePlan,numberPlans,numericProbe}=require('./locale-service.cjs');
const {TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function cell(v,formatted,format){const key=typeof v==='number'?'numberValue':'stringValue';return {userEnteredValue:{[key]:v},effectiveValue:{[key]:v},formattedValue:formatted??String(v),...(format?{effectiveFormat:{numberFormat:format}}:{})};}
function fixture(options={}){
  const row=Array.from({length:14},()=>({}));row[0]=cell('X');row[1]=cell('X');row[3]=cell('X');row[4]=cell(30);row[5]=cell(46236,'08/02/2026',{type:'DATE',pattern:'mm/dd/yyyy'});row[6]=cell(45,'45,00 €');row[7]=cell(1);row[8]=cell('Prueba');row[9]=cell('Barrio manual');row[10]=cell('event');row[11]=cell('Dirección manual');row[12]=cell(17/24,'17:00');row[13]=cell(18.5/24,'18:30');
  const f={rows:[Array.from({length:14},()=>({})),row],groups:[[cell('Grupo')],[cell('Prueba'),cell('Dirección'),cell(30),cell(50),cell('Barrio')]],calls:[],reads:0};
  const event={id:'event',summary:'Prueba',colorId:'5',status:'confirmed',start:{dateTime:'2026-02-08T17:00:00+01:00'},end:{dateTime:'2026-02-08T18:30:00+01:00'}};
  f.request=async(url,token,method='GET',body)=>{
    f.calls.push({url,method,body:clone(body||null)});
    if(url.includes('calendar')){assert.equal(method,'GET');return {items:[options.event||event]};}
    assert(url.includes(TEST_ID));assert(!url.includes(ORIGINAL_ID));
    if(method==='POST'){
      for(const item of body.requests){const u=item.updateCells;assert(u);assert([0,758405382].includes(u.range.sheetId));const rows=u.range.sheetId===0?f.rows:f.groups,c=rows[u.range.startRowIndex][u.range.startColumnIndex],data=u.rows[0].values[0];assert.equal(u.range.endRowIndex,u.range.startRowIndex+1);assert.equal(u.range.endColumnIndex,u.range.startColumnIndex+1);
        if(data.userEnteredValue){c.userEnteredValue=clone(data.userEnteredValue);c.effectiveValue=clone(data.userEnteredValue);}
        c.effectiveFormat={numberFormat:clone(data.userEnteredFormat.numberFormat)};
        if(u.range.sheetId===0&&u.range.startColumnIndex===5)c.formattedValue=D.display(D.dateISO(c));
      }return {};
    }
    f.reads++;options.beforeRead?.(f,f.reads);
    return clone({sheets:[{properties:{title:'Detalle'},data:[{rowData:f.rows.map(values=>({values}))}]},{properties:{title:'Coles'},data:[{rowData:f.groups.map(values=>({values}))}]}]});
  };return f;
}
const payload={spreadsheetId:TEST_ID,action:'audit'};

test('revisión de fecha admite alias pero mantiene ID, horario y color',()=>{
  const f=fixture(),row=f.rows[1];row[8]=cell('Moli de finestrelles');const event={id:'event',summary:'Tramuntana',colorId:'5',start:{dateTime:'2026-02-08T17:00:00+01:00'},end:{dateTime:'2026-02-08T18:30:00+01:00'}};
  assert.equal(datePlan(row,2,[event],[row]).verified,'visible');assert.equal(datePlan(row,2,[{...event,colorId:'1'}],[row]).verified,null);assert.equal(datePlan(row,2,[{...event,id:'otro'}],[row]).verified,null);
});
test('fechas seriales son días de calendario sin ambigüedad ni cambios de zona horaria',()=>{
  assert.equal(D.fromSerial(46236),'2026-08-02');assert.equal(D.parseSpanish('08/02/2026'),'2026-02-08');
  for(const iso of ['2026-03-29','2026-10-25','2025-12-31','2026-01-01','2024-02-29'])assert.equal(D.fromSerial(D.serial(iso)),iso);
  for(const bad of ['31/02/2026','29/02/2025','2026-13-01'])assert.equal(D.parseSpanish(bad),'');assert.equal(D.fromSerial(46236.5),'');
});
test('lectura usa el valor interno, números nativos y horas sin depender del formato visible',async()=>{
  const f=fixture(),data=await runLocale({...payload,action:'data'},'Bearer fake',f.request);
  assert.equal(data.details[0][5],'02/08/2026');assert.equal(data.details[0][6],45);assert.equal(data.details[0][12],'17:00');assert.equal(data.warnings.length,1);assert(f.calls.every(c=>c.method==='GET'));
});
test('la discrepancia se propone con Calendar solo si ID, grupo y horario coinciden',async()=>{
  const f=fixture(),data=await runLocale(payload,'Bearer fake',f.request),plan=data.dates[0];assert.equal(plan.internal,'2026-08-02');assert.equal(plan.visible,'2026-02-08');assert.equal(plan.verified,'visible');assert(f.calls.every(c=>c.method==='GET'));
  for(const event of [{id:'event',summary:'Dentista',colorId:'5'},{id:'event',summary:'Prueba',colorId:'1'},{id:'event',summary:'Prueba',colorId:'5',status:'cancelled'}]){const bad=fixture({event});const p=(await runLocale(payload,'Bearer fake',bad.request)).dates[0];assert.equal(p.verified,null);}
});
test('IDs compartidos y fechas con fórmulas no se intercambian a ciegas',()=>{
  const f=fixture();f.rows.push(clone(f.rows[1]));const plan=datePlan(f.rows[1],2,[],f.rows.slice(1));assert.equal(plan.verified,null);assert.match(plan.reason,/compartido/);
  f.rows[1][5].userEnteredValue={formulaValue:'=DATE(2026,8,2)'};const formula=datePlan(f.rows[1],2,[],f.rows.slice(1));assert(!formula.choices.some(c=>c.key==='visible'));
});
test('aceptar fecha respaldada solo escribe F como número y formato castellano',async()=>{
  const f=fixture(),before=clone(f.rows[1]),review=await runLocale(payload,'Bearer fake',f.request),plan=review.dates[0];
  await runLocale({...payload,action:'applyDates',decisions:[{rowIdx:2,expectedVersion:plan.expectedVersion,choice:'visible',verifiedOnly:true}]},'Bearer fake',f.request);
  const writes=f.calls.filter(c=>c.method!=='GET');assert.equal(writes.length,1);assert.equal(writes[0].body.requests[0].updateCells.range.startColumnIndex,5);assert.equal(D.dateISO(f.rows[1][5]),'2026-02-08');assert.equal(f.rows[1][5].effectiveFormat.numberFormat.pattern,'dd/mm/yyyy');
  for(const c of [0,1,2,3,4,6,7,8,9,10,11,12,13])assert.deepEqual(f.rows[1][c],before[c]);
});
test('conservar fecha interna solo cambia el formato y cancelar selección no escribe',async()=>{
  const f=fixture(),review=await runLocale(payload,'Bearer fake',f.request),plan=review.dates[0];
  const result=await runLocale({...payload,action:'applyDates',decisions:[]},'Bearer fake',f.request);assert.equal(result.unchanged,true);assert(f.calls.every(c=>c.method==='GET'));
  await runLocale({...payload,action:'applyDates',decisions:[{rowIdx:2,expectedVersion:plan.expectedVersion,choice:'internal'}]},'Bearer fake',f.request);const write=f.calls.find(c=>c.method==='POST').body.requests[0].updateCells;assert.equal(write.fields,'userEnteredFormat.numberFormat');assert.equal(D.dateISO(f.rows[1][5]),'2026-08-02');
});
test('una edición posterior o formato cambiado bloquea la migración antes de escribir',async()=>{
  const f=fixture(),review=await runLocale(payload,'Bearer fake',f.request),plan=review.dates[0];f.rows[1][9]=cell('Editado en Sheets');await assert.rejects(()=>runLocale({...payload,action:'applyDates',decisions:[{rowIdx:2,expectedVersion:plan.expectedVersion,choice:'visible'}]},'Bearer fake',f.request),/cambió/);assert(f.calls.every(c=>c.method==='GET'));
});
test('números con coma pasan a número, sin cambiar importes ni congelar fórmulas',async()=>{
  const f=fixture();f.rows[1][4]=cell('16,50 €');f.rows[1][6]={userEnteredValue:{formulaValue:'=E2*H2'},effectiveValue:{numberValue:16.5},formattedValue:'16,50 €'};
  const review=await runLocale({...payload,action:'numbersAudit'},'Bearer fake',f.request),plans=review.numbers.filter(p=>p.kind==='Detalle'&&[4,6,7].includes(p.column));
  await runLocale({...payload,action:'applyNumbers',decisions:plans.map(p=>({kind:p.kind,rowIdx:p.rowIdx,column:p.column,expectedVersion:p.expectedVersion}))},'Bearer fake',f.request);
  assert.equal(f.rows[1][4].userEnteredValue.numberValue,16.5);assert.equal(f.rows[1][6].userEnteredValue.formulaValue,'=E2*H2');assert.equal(f.rows[1][7].userEnteredValue.numberValue,1);
  assert(!f.calls.some(c=>c.url.includes('calendar')));
});
test('texto ambiguo no se convierte y los números nativos no se redondean al normalizar',async()=>{
  const f=fixture();f.rows[1][4]=cell('1.234');f.rows[1][7]=cell(1.234567);
  const review=await runLocale({...payload,action:'numbersAudit'},'Bearer fake',f.request),blocked=review.numbers.find(p=>p.rowIdx===2&&p.column===4);assert.equal(blocked.blocked,true);
  const hour=review.numbers.find(p=>p.kind==='Detalle'&&p.rowIdx===2&&p.column===7);await runLocale({...payload,action:'applyNumbers',decisions:[hour]},'Bearer fake',f.request);assert.equal(f.rows[1][7].userEnteredValue.numberValue,1.234567);
  await assert.rejects(()=>runLocale({...payload,action:'applyNumbers',decisions:[blocked]},'Bearer fake',f.request),/seguridad/);
});
test('normalización es repetible sin nuevas escrituras y protege la hoja original',async()=>{
  const f=fixture(),review=await runLocale({...payload,action:'numbersAudit'},'Bearer fake',f.request);await runLocale({...payload,action:'applyNumbers',decisions:review.numbers.filter(p=>!p.blocked)},'Bearer fake',f.request);const again=await runLocale({...payload,action:'numbersAudit'},'Bearer fake',f.request);assert.equal(again.numbers.length,0);
  const g=fixture();await assert.rejects(()=>runLocale({...payload,spreadsheetId:ORIGINAL_ID,action:'check'},'Bearer fake',g.request));assert.equal(g.calls.length,0);
});
test('prueba numérica verifica suma y origen del gráfico, y retira la pestaña incluso al fallar',async()=>{
  for(const failed of [false,true]){const calls=[];let chart;
    const request=async(url,token,method='GET',body)=>{calls.push({url,method,body});assert(url.includes(TEST_ID));
      if(calls.length===1)return {replies:[{addSheet:{properties:{sheetId:77}}}]};
      if(method==='POST'){const added=body.requests.find(r=>r.addChart);if(added)chart=added.addChart.chart;return {};}
      return {sheets:[{properties:{sheetId:77},charts:[chart],data:[{rowData:[{},{},{},{values:[{}, {effectiveValue:{numberValue:36.75},formattedValue:failed?'36.75 €':'36,75 €'}]}]}]}]};
    };
    if(failed)await assert.rejects(()=>numericProbe('Bearer fake',request),/formato español/);else assert.equal((await numericProbe('Bearer fake',request)).sum,36.75);
    assert.deepEqual(calls.at(-1).body,{requests:[{deleteSheet:{sheetId:77}}]});
  }
});
