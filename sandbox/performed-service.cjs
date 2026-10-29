const {TEST_ID,validateTarget}=require('./policy.cjs');
const {snapshot}=require('./protected-service.cjs');
const {fingerprint}=require('./locale-service.cjs');
const D=require('../locale-data.js'),L=require('../calendar-linking.js');
function madridNow(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),v=type=>parts.find(p=>p.type===type).value;
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}`;
}
const excluded=row=>String(D.value(row[14])).trim().toUpperCase()==='NO'||D.value(row[14])===false;
function ended(row,now){const date=D.dateISO(row[5]),end=D.time(D.value(row[13]));return !!date&&!!end&&`${date} ${end}`<=madridNow(now);}
function eligible(row,now,rowIdx){
  const visible=D.parseSpanish(row[5]?.formattedValue),formula=row[6]?.userEnteredValue?.formulaValue;
  const safeFormula=new RegExp('^=\\s*\\$?E\\$?'+rowIdx+'\\s*\\*\\s*\\$?H\\$?'+rowIdx+'\\s*$','i');
  return !excluded(row)&&!row[4]?.userEnteredValue?.formulaValue&&(!formula||safeFormula.test(formula))&&!row[1]?.userEnteredValue?.formulaValue&&['',false].includes(D.value(row[1]))&&!!String(D.value(row[10])).trim()&&!!D.time(D.value(row[12]))&&(!visible||visible===D.dateISO(row[5]))&&ended(row,now);
}
async function runPerformed(payload,token,request,now=new Date()){
  validateTarget(payload.spreadsheetId);if(payload.action!=='autoPerformed'||Object.keys(payload).some(k=>!['spreadsheetId','action','beforeRow'].includes(k))||(payload.beforeRow!==undefined&&(!Number.isInteger(payload.beforeRow)||payload.beforeRow<0)))throw new Error('Acción de realizado no válida.');
  const snap=await snapshot(token,request),ids=new Map();for(const row of snap.rows){const id=String(D.value(row?.[10]));if(id)ids.set(id,(ids.get(id)||0)+1);}
  const header=String(D.value(snap.rows[0]?.[14])).trim();
  if(header&&header!=='Realizado automático')throw Error('La columna O ya tiene otro uso. Revisa la hoja antes de activar Realizado automático.');
  if(snap.rows.slice(1).some(row=>!['','NO','SI','SÍ',true,false].includes(D.value(row[14]))))throw Error('Hay datos no reconocidos en la columna O. Realizado automático queda detenido.');
  const pending=snap.rows.map((row,i)=>({row,rowIdx:i+1})).filter(p=>p.rowIdx>1&&eligible(p.row,now,p.rowIdx));
  const candidates=pending.filter(p=>ids.get(String(D.value(p.row[10])))===1&&(!payload.beforeRow||p.rowIdx<payload.beforeRow)).sort((a,b)=>b.rowIdx-a.rowIdx).slice(0,20);
  const nextCursor=candidates.length===20?candidates.at(-1).rowIdx:0;
  const verified=[];let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{while(cursor<candidates.length){const candidate=candidates[cursor++],id=String(D.value(candidate.row[10]));let event;try{event=await request(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`,token);}catch(error){if([404,410].includes(error.status))continue;throw error;}
    const row={grupo:String(D.value(candidate.row[8])),fechaStr:D.display(D.dateISO(candidate.row[5])),horaInicio:D.time(D.value(candidate.row[12])),horaFin:D.time(D.value(candidate.row[13]))};
    if(event?.id===id&&L.compatible(row,event)&&event.end?.dateTime&&new Date(event.end.dateTime)<=now)verified.push(candidate);
  }}));
  if(!verified.length)return {rowsChanged:0,performed:[],nextCursor,skipped:pending.length,spreadsheetId:TEST_ID,calendarModified:false};
  const fresh=await snapshot(token,request),requests=[];const targets=[];
  if(fingerprint(fresh.rows[0])!==fingerprint(snap.rows[0]))throw Error('La cabecera cambió durante la comprobación. Recarga.');
  for(const candidate of verified){const current=fresh.rows[candidate.rowIdx-1],id=String(D.value(candidate.row[10]));if(!current||fingerprint(current)!==fingerprint(candidate.row)||!eligible(current,now,candidate.rowIdx)||fresh.rows.filter(row=>String(D.value(row?.[10]))===id).length!==1)continue;
    const value=typeof D.value(current[1])==='boolean'?{boolValue:true}:{stringValue:'X'};requests.push({updateCells:{range:{sheetId:0,startRowIndex:candidate.rowIdx-1,endRowIndex:candidate.rowIdx,startColumnIndex:1,endColumnIndex:2},rows:[{values:[{userEnteredValue:value}]}],fields:'userEnteredValue'}});targets.push(candidate.rowIdx);
  }
  if(!requests.length)return {rowsChanged:0,performed:[],nextCursor,skipped:pending.length,spreadsheetId:TEST_ID,calendarModified:false};
  try{await request(`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}:batchUpdate`,token,'POST',{requests});}catch(error){throw new Error('El marcado automático no pudo confirmarse. Recarga antes de reintentarlo. '+error.message);}
  const after=await snapshot(token,request),performed=[];for(const rowIdx of targets){const row=after.rows[rowIdx-1],previous=fresh.rows[rowIdx-1];if(!row||!['X',true].includes(D.value(row[1]))||fingerprint(row.filter((_,i)=>i!==1))!==fingerprint(previous.filter((_,i)=>i!==1)))throw new Error('Se envió el marcado automático, pero falta verificar la sesión completa. Recarga.');performed.push({rowIdx,version:fingerprint(row)});}
  return {rowsChanged:performed.length,performed,nextCursor,skipped:pending.length-performed.length,spreadsheetId:TEST_ID,calendarModified:false};
}
module.exports={runPerformed,madridNow,ended,eligible,excluded};
