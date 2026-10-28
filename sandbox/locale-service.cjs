const D=require('../locale-data.js'),L=require('../calendar-linking.js');
const {snapshot}=require('./protected-service.cjs');
const {TEST_ID,validateTarget}=require('./policy.cjs');
const {createHash}=require('node:crypto');
const BASE=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`;
const fingerprint=cells=>createHash('sha256').update(JSON.stringify(cells.map(c=>[c?.userEnteredValue||{},c?.effectiveValue||{},c?.effectiveFormat?.numberFormat||{}]))).digest('hex');
function datePlan(cells,rowIdx,events,allRows){
  const c=cells[5],internal=D.dateISO(c),visible=D.parseSpanish(c?.formattedValue),id=String(D.value(cells[10])),group=String(D.value(cells[8]));
  if(!internal&&!visible)return null;
  const conflict=!!internal&&!!visible&&internal!==visible;
  const formula=!!c?.userEnteredValue?.formulaValue;
  const choices=[];if(internal)choices.push({key:'internal',iso:internal,label:'Conservar fecha interna y mostrarla en castellano'});
  if(visible&&visible!==internal&&!formula)choices.push({key:'visible',iso:visible,label:'Usar la fecha que se mostraba en la hoja'});
  const claimed=id&&allRows.filter(row=>String(D.value(row[10]))===id).length>1;
  const event=id&&!claimed?events.find(e=>e.id===id):null;
  let verified=null,reason=claimed?'ID compartido: requiere revisión.':!id?'Sin CalendarId: requiere revisión.':'Sin evento amarillo compatible: requiere revisión.';
  if(event&&String(event.colorId)==='5'&&event.status!=='cancelled'&&L.groupFromTitle(event.summary)===L.normalize(group)){
    const hours=L.hours(event),start=D.time(D.value(cells[12])),end=D.time(D.value(cells[13]));
    const day=L.calendarDate(event);
    if((!start||hours.horaInicio===start)&&(!end||hours.horaFin===end)&&choices.some(choice=>choice.iso===day)){
      verified=choices.find(choice=>choice.iso===day).key;reason='Calendar confirma grupo, día y horario disponible.';
    }
  }
  if(formula&&conflict)reason='La fecha procede de una fórmula. No se reemplaza automáticamente.';
  const format=c?.effectiveFormat?.numberFormat;
  const needsFormat=format?.type!=='DATE'||format?.pattern!=='dd/mm/yyyy';
  const textDate=typeof D.value(c)!=='number';
  if(!conflict&&!textDate&&!needsFormat)return null;
  if(!conflict&&!textDate){verified='internal';reason='Solo normaliza el formato; conserva el día interno y las fórmulas.';}
  return {rowIdx,group,internal,visible,conflict,textDate,formula,choices,verified,reason,expectedVersion:fingerprint(cells),calendar:event?{title:event.summary,date:L.calendarDate(event)}:null};
}
function numberPlans(snap){const out=[];for(const [kind,rows,sheetId,columns]of [['Detalle',snap.rows,0,[4,6,7]],['Coles',snap.groups,758405382,[2,3]]]){
  for(let r=1;r<rows.length;r++){const row=rows[r];if(!row)continue;for(const column of columns){const c=row[column],raw=D.value(c);if(raw==='')continue;const n=D.numeric(raw),formula=!!c?.userEnteredValue?.formulaValue;
    const format=column===7&&kind==='Detalle'?{type:'NUMBER',pattern:'#,##0.########'}:{type:'CURRENCY',pattern:'#,##0.00" €"'};
    if(n===null){out.push({kind,rowIdx:r+1,column,sheetId,blocked:true,reason:'Texto numérico ambiguo; no se convierte.',shown:c?.formattedValue||String(raw)});continue;}
    if(typeof raw==='number'&&c.effectiveFormat?.numberFormat?.type===format.type&&c.effectiveFormat?.numberFormat?.pattern===format.pattern)continue;
    out.push({kind,rowIdx:r+1,column,sheetId,n,formula,convert:typeof raw!=='number'&&!formula,format,blocked:false,expectedVersion:fingerprint(row)});
  }}
}return out;}
async function calendarFor(snap,token,request){
  const dates=snap.rows.slice(1).flatMap(row=>row?[D.dateISO(row[5]),D.parseSpanish(row[5]?.formattedValue)].filter(Boolean):[]).sort();
  if(!dates.length)return [];
  const start=new Date(`${dates[0]}T00:00:00Z`),end=new Date(`${dates[dates.length-1]}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-1);end.setUTCDate(end.getUTCDate()+2);
  return (await L.listAll(params=>request(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])))}`,token),{timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:true,orderBy:'startTime'})).items;
}
async function readNative(token,request){const snap=await snapshot(token,request);const details=snap.rows.slice(1).map(c=>D.rowValues(c)),groups=snap.groups.slice(1).map(c=>D.rowValues(c,'group'));const warnings=snap.rows.slice(1).map((c,i)=>({rowIdx:i+2,internal:D.dateISO(c[5]),visible:D.parseSpanish(c[5]?.formattedValue)})).filter(r=>r.internal&&r.visible&&r.internal!==r.visible);const amountWarnings=[];snap.rows.slice(1).forEach((row,i)=>{for(const col of [4,6,7])if(D.value(row[col])!==''&&D.numeric(D.value(row[col]))===null)amountWarnings.push({rowIdx:i+2,column:col});});return {details,groups,warnings,amountWarnings,spreadsheetId:TEST_ID,locale:'es_ES',timeZone:'Europe/Madrid'};}
function cellRequest(sheetId,row,column,value,format){const data={userEnteredFormat:{numberFormat:format}};if(value)data.userEnteredValue=value;return {updateCells:{range:{sheetId,startRowIndex:row-1,endRowIndex:row,startColumnIndex:column,endColumnIndex:column+1},rows:[{values:[data]}],fields:'userEnteredFormat.numberFormat'+(value?',userEnteredValue':'')}};}
async function runLocale(payload,token,request){
  validateTarget(payload.spreadsheetId);
  if(payload.action==='check')return numericProbe(token,request);
  if(payload.action==='data')return readNative(token,request);
  if(!['audit','numbersAudit','applyDates','applyNumbers'].includes(payload.action))throw new Error('Acción de fechas no permitida.');
  const snap=await snapshot(token,request);
  if(payload.action==='numbersAudit')return {numbers:numberPlans(snap),spreadsheetId:TEST_ID};
  const events=payload.action==='applyNumbers'?[]:await calendarFor(snap,token,request);
  const dates=snap.rows.slice(1).map((row,i)=>datePlan(row,i+2,events,snap.rows.slice(1))).filter(Boolean),numbers=numberPlans(snap);
  if(payload.action==='audit')return {dates,numbers,spreadsheetId:TEST_ID,locale:'es_ES',timeZone:'Europe/Madrid',conflicts:dates.filter(p=>p.conflict).length};
  const requests=[],checks=[],expectedRows=new Map();
  if(payload.action==='applyDates'){
    if(!Array.isArray(payload.decisions)||payload.decisions.length>500)throw new Error('Revisa como máximo 500 fechas por lote.');
    for(const decision of payload.decisions){
      const plan=dates.find(p=>p.rowIdx===decision.rowIdx);if(!plan||plan.expectedVersion!==decision.expectedVersion)throw new Error('La fecha cambió desde la revisión. Recarga antes de guardar.');
      if(expectedRows.has(`Detalle:${plan.rowIdx}`))throw new Error('Fila repetida.');
      const choice=plan.choices.find(c=>c.key===decision.choice);if(!choice)throw new Error('Elige una de las fechas revisadas.');
      if(decision.verifiedOnly&&plan.verified!==choice.key)throw new Error('Calendar ya no confirma la selección.');
      const cells=snap.rows[plan.rowIdx-1],sameNative=typeof D.value(cells[5])==='number'&&D.dateISO(cells[5])===choice.iso;
      if(plan.formula&&!sameNative)throw new Error('No se reemplazan fórmulas de fecha.');
      requests.push(cellRequest(0,plan.rowIdx,5,sameNative?null:{numberValue:D.serial(choice.iso)},{type:'DATE',pattern:'dd/mm/yyyy'}));
      checks.push({kind:'Detalle',rowIdx:plan.rowIdx,column:5,value:sameNative?null:D.serial(choice.iso),format:'dd/mm/yyyy'});expectedRows.set(`Detalle:${plan.rowIdx}`,plan.expectedVersion);
    }
  }else{
    if(!Array.isArray(payload.decisions)||payload.decisions.length>500)throw new Error('Normaliza como máximo 500 celdas por lote.');
    const seen=new Set();for(const decision of payload.decisions){const key=`${decision.kind}:${decision.rowIdx}:${decision.column}`;if(seen.has(key))throw new Error('Celda repetida.');seen.add(key);
      const plan=numbers.find(p=>p.kind===decision.kind&&p.rowIdx===decision.rowIdx&&p.column===decision.column);if(!plan||plan.blocked||plan.expectedVersion!==decision.expectedVersion)throw new Error('El importe cambió o no se puede convertir con seguridad.');
      requests.push(cellRequest(plan.sheetId,plan.rowIdx,plan.column,plan.convert?{numberValue:plan.n}:null,plan.format));checks.push({kind:plan.kind,rowIdx:plan.rowIdx,column:plan.column,value:plan.convert?plan.n:null,format:plan.format.pattern});expectedRows.set(`${plan.kind}:${plan.rowIdx}`,plan.expectedVersion);
    }
  }
  if(!requests.length)return {unchanged:true,cellsChanged:0,calendarModified:false};
  const fresh=await snapshot(token,request);for(const [key,version]of expectedRows){const [kind,row]=key.split(':');if(fingerprint((kind==='Detalle'?fresh.rows:fresh.groups)[+row-1]||[])!==version)throw new Error('Se editó una fila durante la confirmación. No se guardó nada.');}
  await request(`${BASE}:batchUpdate`,token,'POST',{requests});
  const verified=await snapshot(token,request);for(const check of checks){const c=(check.kind==='Detalle'?verified.rows:verified.groups)[check.rowIdx-1]?.[check.column];if(check.value!==null&&c?.userEnteredValue?.numberValue!==check.value)throw new Error('Se envió el cambio, pero falta verificar el valor. Recarga.');if(c?.effectiveFormat?.numberFormat?.pattern!==check.format)throw new Error('No se pudo verificar el formato. Recarga.');}
  return {cellsChanged:checks.length,calendarModified:false,spreadsheetId:TEST_ID};
}
async function numericProbe(token,request){
  let sheetId;
  try{
    const title=`Prueba castellano ${Date.now()}`;
    const added=await request(`${BASE}:batchUpdate`,token,'POST',{requests:[{addSheet:{properties:{title,gridProperties:{rowCount:8,columnCount:3}}}}]});
    sheetId=added.replies?.[0]?.addSheet?.properties?.sheetId;if(!Number.isInteger(sheetId))throw new Error('No se pudo verificar la pestaña temporal.');
    await request(`${BASE}:batchUpdate`,token,'POST',{requests:[
      {updateCells:{range:{sheetId,startRowIndex:0,endRowIndex:4,startColumnIndex:0,endColumnIndex:2},rows:[{values:[{userEnteredValue:{stringValue:'Concepto'}},{userEnteredValue:{stringValue:'Importe'}}]},{values:[{userEnteredValue:{stringValue:'Primero'}},{userEnteredValue:{numberValue:16.5},userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'#,##0.00" €"'}}}]},{values:[{userEnteredValue:{stringValue:'Segundo'}},{userEnteredValue:{numberValue:20.25},userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'#,##0.00" €"'}}}]},{values:[{userEnteredValue:{stringValue:'Suma'}},{userEnteredValue:{formulaValue:'=SUM(B2:B3)'},userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'#,##0.00" €"'}}}]}],fields:'userEnteredValue,userEnteredFormat.numberFormat'}},
      {addChart:{chart:{spec:{title:'Comprobación de importes numéricos',basicChart:{chartType:'COLUMN',headerCount:1,domains:[{domain:{sourceRange:{sources:[{sheetId,startRowIndex:0,endRowIndex:3,startColumnIndex:0,endColumnIndex:1}]}}}],series:[{series:{sourceRange:{sources:[{sheetId,startRowIndex:0,endRowIndex:3,startColumnIndex:1,endColumnIndex:2}]}},targetAxis:'LEFT_AXIS'}]}},position:{overlayPosition:{anchorCell:{sheetId,rowIndex:0,columnIndex:2}}}}}}
    ]});
    const query=new URLSearchParams({includeGridData:'true',fields:'sheets(properties(sheetId),charts(spec),data(rowData(values(effectiveValue,formattedValue))))'});query.append('ranges',`'${title}'!A1:B4`);
    const result=await request(`${BASE}?${query}`,token),sheet=result.sheets?.find(s=>s.properties.sheetId===sheetId),rows=sheet?.data?.[0]?.rowData;
    const total=rows?.[3]?.values?.[1];if(total?.effectiveValue?.numberValue!==36.75||!total.formattedValue?.includes('36,75'))throw new Error('La suma o su formato español no coincide con 36,75.');
    if(!sheet?.charts?.some(chart=>chart.spec.basicChart?.series?.[0]?.series?.sourceRange?.sources?.[0]?.sheetId===sheetId))throw new Error('No se pudo comprobar el origen numérico del gráfico.');
    return {sum:36.75,formatted:total.formattedValue,chartDataVerified:true,calendarModified:false,restored:true};
  }finally{if(Number.isInteger(sheetId)){try{await request(`${BASE}:batchUpdate`,token,'POST',{requests:[{deleteSheet:{sheetId}}]});}catch{throw new Error(`No se pudo retirar la pestaña temporal (${sheetId}). Revísala antes de repetir la prueba.`);}}}
}
module.exports={runLocale,readNative,datePlan,numberPlans,fingerprint,numericProbe};
