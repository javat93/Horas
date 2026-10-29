const {test}=require('node:test'),assert=require('node:assert/strict');
const {runGroups,normalize}=require('./group-service.cjs');
const {TEST_ID,ORIGINAL_ID}=require('./policy.cjs');
const D=require('../locale-data.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cell=v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v},effectiveValue:typeof v==='number'?{numberValue:v}:{stringValue:v}});
function fixture(values=['Cole','Calle especial',25,50,'Sant Andreu']){
  const rows=[['Grupo','Dirección','Precio','Precio Bolo','Ubicación'].map(cell),values.map(cell)],writes=[];
  const request=async(url,token,method='GET',body)=>{
    assert(url.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`));
    if(method==='GET')return {sheets:[{properties:{title:'Coles'},data:[{rowData:structuredClone(rows).map(values=>({values}))}]}]};
    writes.push(body);for(const r of body.requests){const u=r.updateCells;assert.equal(u.range.sheetId,758405382);assert(u.range.startColumnIndex>=2&&u.range.endColumnIndex<=5);const c=u.rows[0].values[0];rows[u.range.startRowIndex][u.range.startColumnIndex]={...c,effectiveValue:c.userEnteredValue};}return {};
  };
  return {rows,writes,request};
}
const payload={spreadsheetId:TEST_ID,rowIdx:2,proposal:{gigPrice:'80,50',location:'Sant Andreu'}};
test('auditar y previsualizar no escriben; detecta cruce sin repararlo automáticamente',async()=>{
  const f=fixture(['Cole','Calle',25,'Sant Andreu',80]);const a=await runGroups({spreadsheetId:TEST_ID,action:'audit'},'',f.request);assert.equal(a.groups[0].suspected,true);assert.equal(f.writes.length,0);
  const p=await runGroups({...payload,action:'preview'},'',f.request);assert.equal(p.proposal.gigPrice,80.5);assert.equal(f.writes.length,0);
});
test('guardar bolo de 80 y barrio mantiene C, A y B, recarga en D/E y es repetible',async()=>{
  const f=fixture();const input={...payload,proposal:{gigPrice:'80',location:'Sant Andreu'}};const p=await runGroups({...input,action:'preview'},'',f.request);
  const saved=await runGroups({...input,action:'apply',expectedVersion:p.expectedVersion,choices:{gigPrice:'use',location:'use'}},'',f.request);assert.equal(saved.cellsChanged,1);
  assert.deepEqual(f.rows[1].map(D.value),['Cole','Calle especial',25,80,'Sant Andreu']);
  const reopened=await runGroups({...input,action:'preview'},'',f.request);assert.equal(reopened.current.gigPrice,80);assert.equal(reopened.current.location,'Sant Andreu');
  const again=await runGroups({...input,action:'apply',expectedVersion:reopened.expectedVersion,choices:{gigPrice:'use',location:'use'}},'',f.request);assert.equal(again.unchanged,true);assert.equal(f.writes.length,1);
});
test('conservar mantiene fórmulas y barrio manual; aceptar solo ubicación no toca precios',async()=>{
  const f=fixture();f.rows[1][2]={userEnteredValue:{formulaValue:'=20+5'},effectiveValue:{numberValue:25}};
  const p=await runGroups({...payload,proposal:{price:30,location:'Barrio nuevo'},action:'preview'},'',f.request);
  await runGroups({...payload,proposal:p.proposal,action:'apply',expectedVersion:p.expectedVersion,choices:{}},'',f.request);assert.equal(f.writes.length,0);
  await runGroups({...payload,proposal:p.proposal,action:'apply',expectedVersion:p.expectedVersion,choices:{location:'use'}},'',f.request);assert.equal(f.rows[1][2].userEnteredValue.formulaValue,'=20+5');assert.equal(D.value(f.rows[1][3]),50);
});
test('una edición manual posterior impide guardar con revisión antigua',async()=>{
  const f=fixture(),p=await runGroups({...payload,action:'preview'},'',f.request);f.rows[1][4]=cell('Barrio escrito en Sheets');
  await assert.rejects(()=>runGroups({...payload,action:'apply',expectedVersion:p.expectedVersion,choices:{location:'use'}},'',f.request),/cambió/);assert.equal(f.writes.length,0);
});
test('no inventa tarifas, acepta cero y decimales, rechaza columnas y decisiones extra',async()=>{
  assert.equal(normalize({gigPrice:0}).gigPrice,0);assert.equal(normalize({price:'16,50'}).price,16.5);
  for(const value of ['Sant Andreu','','1.234',-1])assert.throws(()=>normalize({gigPrice:value}));
  assert.throws(()=>normalize({name:'Otro cole'}));const f=fixture(),p=await runGroups({...payload,action:'preview'},'',f.request);
  await assert.rejects(()=>runGroups({...payload,action:'apply',expectedVersion:p.expectedVersion,choices:{address:'use'}},'',f.request));assert.equal(f.writes.length,0);
});
test('original rechazado antes de leer, Calendar nunca se consulta ni se escribe',async()=>{
  let calls=0;await assert.rejects(()=>runGroups({...payload,spreadsheetId:ORIGINAL_ID,action:'preview'},'',async()=>calls++));assert.equal(calls,0);
  const f=fixture();await runGroups({...payload,action:'preview'},'',f.request);
});
test('formulario real escribe A/B/C/D/E en orden con importes numéricos; texto inválido no se guarda',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const handler=html.match(/document.getElementById\('form-grupo'\).onsubmit = async \(e\) => \{([\s\S]*?)\n        \};/)[0];
  const fields={'form-grupo':{},'gr-rowIdx':{value:'2'},'gr-nombre':{value:'Cole'},'gr-sitio':{value:'Calle'},'gr-precio':{value:'16,50'},'gr-precio-bolo':{value:'80'},'gr-ubicacion':{value:'Sant Andreu'}};
  const calls=[],errors=[];vm.runInNewContext(handler,{document:{getElementById:id=>fields[id]},LocaleData:D,CONFIG:{SPREADSHEET_ID:TEST_ID},proxyGoogleAPI:async(...args)=>calls.push(args),closeModal(){},syncData(){},showErrorModal:(...args)=>errors.push(args),console});
  await fields['form-grupo'].onsubmit({preventDefault(){}});assert.equal(calls[0][2].range,'Coles!A2:E2');assert.equal(JSON.stringify(calls[0][3].values),JSON.stringify([['Cole','Calle',16.5,80,'Sant Andreu']]));
  fields['gr-precio-bolo'].value='Sant Andreu';await fields['form-grupo'].onsubmit({preventDefault(){}});assert.equal(calls.length,1);assert.equal(errors.length,1);
});
