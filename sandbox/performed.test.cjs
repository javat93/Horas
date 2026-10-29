const {test}=require('node:test'),assert=require('node:assert/strict');
const {runPerformed,madridNow,ended}=require('./performed-service.cjs'),D=require('../locale-data.js');
const {TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const cell=v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v},effectiveValue:typeof v==='number'?{numberValue:v}:{stringValue:v},formattedValue:String(v)});
const now=new Date('2026-10-29T10:00:00Z'),payload={spreadsheetId:TEST_ID,action:'autoPerformed'};
function fixture(opts={}){
  const rows=[Array.from({length:15},()=>({})),Array.from({length:15},()=>({}))];
  for(const [i,v]of [[4,50],[5,D.serial('2026-10-29')],[6,50],[7,1],[8,'Cole'],[9,'Barrio manual'],[10,'event'],[11,'Calle manual'],[12,'09:00'],[13,'10:00']])rows[1][i]=cell(v);
  const event={id:'event',summary:'Cole - Clase',colorId:'5',status:'confirmed',start:{dateTime:'2026-10-29T09:00:00+01:00'},end:{dateTime:'2026-10-29T10:00:00+01:00'},...opts.event};
  const calls=[];let reads=0;
  const request=async(url,token,method='GET',body)=>{
    calls.push({url,method,body});
    if(url.includes('/calendar/')){assert.equal(method,'GET');if(opts.calendarError)throw opts.calendarError;return event;}
    assert(url.includes(TEST_ID));
    if(method==='POST'){if(opts.failWrite)throw Error('Sin red');for(const {updateCells:u} of body.requests){assert.equal(u.range.startColumnIndex,1);assert.equal(u.range.endColumnIndex,2);assert.equal(u.range.sheetId,0);rows[u.range.startRowIndex][1]={userEnteredValue:u.rows[0].values[0].userEnteredValue,effectiveValue:u.rows[0].values[0].userEnteredValue};}return {};}
    if(url.includes('/values:batchGet'))return {valueRanges:[{values:rows.map(r=>r.map(D.value))},{values:[['Grupo']]}]};
    reads++;if(opts.beforeRead)opts.beforeRead(rows,reads);
    return {sheets:[{properties:{title:'Detalle'},data:[{rowData:structuredClone(rows).map(values=>({values}))}]},{properties:{title:'Coles'},data:[{rowData:[]}]}]};
  };
  return {rows,calls,request};
}
test('Realizado usa Madrid, cambio de horario y fin real; H=1 no es duración',()=>{
  assert.equal(madridNow(new Date('2026-10-25T00:30:00Z')),'2026-10-25 02:30');assert.equal(madridNow(new Date('2026-10-25T01:30:00Z')),'2026-10-25 02:30');
  const f=fixture();assert.equal(ended(f.rows[1],new Date('2026-10-29T08:59:00Z')),false);assert.equal(ended(f.rows[1],new Date('2026-10-29T09:00:00Z')),true);
  f.rows[1][13]={};assert.equal(ended(f.rows[1],now),false);
});
test('marca solo B, verifica la fila, conserva importes, H, barrio y dirección; repetición idempotente',async()=>{
  const f=fixture(),before=structuredClone(f.rows[1]);const result=await runPerformed(payload,'',f.request,now);assert.equal(result.rowsChanged,1);assert.equal(result.calendarModified,false);
  for(let i=0;i<15;i++)if(i!==1)assert.deepEqual(f.rows[1][i],before[i]);
  assert.equal((await runPerformed(payload,'',f.request,now)).rowsChanged,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('cancelado, otro color, grupo, horario o fecha y evento aún en curso nunca se marcan',async()=>{
  for(const event of [{status:'cancelled'},{colorId:'1'},{summary:'Otro cole'},{start:{dateTime:'2026-10-29T08:00:00+01:00'}},{start:{dateTime:'2026-10-28T09:00:00+01:00'}},{end:{dateTime:'2026-10-29T10:00:00-05:00'}}]){const f=fixture({event});assert.equal((await runPerformed(payload,'',f.request,now)).rowsChanged,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);}
});
test('respeta NO, fecha ambigua, fórmulas, estado desconocido y vínculos compartidos',async()=>{
  for(const modify of [r=>r[1][14]=cell('NO'),r=>r[1][5].formattedValue='10/11/2026',r=>r[1][1]={userEnteredValue:{formulaValue:'=FALSE()'}},r=>r[1][1]=cell('Cancelada'),r=>r[1][6]={userEnteredValue:{formulaValue:'=IF(B2;80;50)'},effectiveValue:{numberValue:50}},r=>r.push(structuredClone(r[1]))]){
    const f=fixture();modify(f.rows);assert.equal((await runPerformed(payload,'',f.request,now)).rowsChanged,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  }
});
test('edición manual concurrente se conserva; O con otro uso bloquea el automatismo',async()=>{
  const f=fixture({beforeRead:(rows,n)=>{if(n===2)rows[1][9]=cell('Barrio nuevo');}});assert.equal((await runPerformed(payload,'',f.request,now)).rowsChanged,0);assert.equal(f.rows[1][9].effectiveValue.stringValue,'Barrio nuevo');
  for(const at of [0,1]){const g=fixture();g.rows[at][14]=cell('Otra información');await assert.rejects(()=>runPerformed(payload,'',g.request,now),/columna O/);assert.equal(g.calls.filter(c=>c.method==='POST').length,0);}
});
test('404 se omite; fallos de cuota o escritura se propagan sin reintento ni falso éxito',async()=>{
  const f=fixture({calendarError:Object.assign(Error('No existe'),{status:404})});assert.equal((await runPerformed(payload,'',f.request,now)).rowsChanged,0);
  for(const opts of [{calendarError:Object.assign(Error('Cuota'),{status:429})},{failWrite:true}]){const g=fixture(opts);await assert.rejects(()=>runPerformed(payload,'',g.request,now));assert.equal(g.calls.filter(c=>c.method==='POST').length,opts.failWrite?1:0);}
  let calls=0;await assert.rejects(()=>runPerformed({...payload,spreadsheetId:ORIGINAL_ID},'',()=>calls++,now));assert.equal(calls,0);
});
test('lotes recorren todas las filas aunque los primeros veinte eventos estén cancelados',async()=>{
  const f=fixture({event:{status:'cancelled'}});for(let i=2;i<27;i++){const row=structuredClone(f.rows[1]);row[10]=cell('event'+i);f.rows.push(row);}
  const first=await runPerformed(payload,'',f.request,now);assert(first.nextCursor>0);const second=await runPerformed({...payload,beforeRow:first.nextCursor},'',f.request,now);assert.equal(second.nextCursor,0);assert.equal(f.calls.filter(c=>c.url.includes('/calendar/')).length,26);
});
