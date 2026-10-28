const Links=require('../calendar-linking.js');
const {TEST_ID,validateTarget}=require('./policy.cjs');
const BASE=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`;
const CAL='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const {snapshot:readSnapshot}=require('./protected-service.cjs');
const D=require('../locale-data.js');
async function readNative(token,request){const snap=await readSnapshot(token,request);return {details:snap.rows.slice(1).map(cells=>cells.map((c,i)=>i===5?D.display(D.dateISO(c)):[12,13].includes(i)?D.time(D.value(c)):c?.formattedValue??D.value(c)))};}
function sameRow(a,b){return Array.isArray(b)&&b.length===14&&JSON.stringify(a)===JSON.stringify(b);}
async function runLinks(payload,token,request){
  validateTarget(payload.spreadsheetId);
  if(!['audit','candidates','apply'].includes(payload.action))throw new Error('Acción de vínculos no permitida.');
  const snapshot=await readNative(token,request);
  const rows=snapshot.details.map((v,i)=>Links.rowFromValues(v,i+2));
  if(payload.action==='audit')return {rows:rows.filter(r=>r.grupo||r.fechaStr),shared:Links.sharedIds(rows),missing:rows.filter(r=>r.grupo&&!r.calEventId),spreadsheetId:TEST_ID};
  const row=rows.find(r=>r.rowIdx===payload.rowIdx);
  if(!row || !sameRow(row.expectedRow,payload.expectedRow))throw new Error('La fila cambió desde la revisión. Recarga el análisis antes de continuar.');
  async function getEvent(id){
    try{return await request(`${CAL}/${encodeURIComponent(id)}`,token);}
    catch(error){if([404,410].includes(error.status))return {id,status:'cancelled',missing:true};throw error;}
  }
  if(payload.action==='candidates'){
    const key=Links.dateKey(row.fechaStr);if(!key)throw new Error('Fecha no reconocida. Se revisará en la fase de fechas.');
    // Ventana UTC amplia; el filtro posterior compara el día exacto en Madrid.
    const start=new Date(`${key}T00:00:00Z`);start.setUTCDate(start.getUTCDate()-1);
    const end=new Date(`${key}T00:00:00Z`);end.setUTCDate(end.getUTCDate()+2);
    const response=await Links.listAll(params=>request(`${CAL}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])))}`,token),{timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:true,orderBy:'startTime'});
    const choice=Links.choose(row,response.items,rows);
    const current=row.calEventId?await getEvent(row.calEventId):null;
    const describe=event=>event?{id:event.id,title:event.summary||'(sin título)',date:Links.calendarDate(event),...(!event.missing?Links.hours(event):{horaInicio:'',horaFin:''}),yellow:String(event.colorId)==='5',cancelled:event.status==='cancelled',claimedBy:event.claimedBy||[]}:null;
    return {row,status:choice.status,current:describe(current),candidates:choice.candidates.map(describe),calendarReadOnly:true};
  }
  if(typeof payload.newEventId!=='string')throw new Error('Selecciona un evento o deja el vínculo vacío.');
  const newId=payload.newEventId;
  if(newId===row.calEventId)return {unchanged:true,rowIdx:row.rowIdx};
  if(newId){
    if(rows.some(other=>other.rowIdx!==row.rowIdx&&other.calEventId===newId))throw new Error('Ese evento ya pertenece a otra fila. Primero resuelve el vínculo compartido.');
    const event=await getEvent(newId);
    if(!Links.compatible(row,event))throw new Error('El evento no coincide en grupo, fecha y horario, está cancelado o no es amarillo. No se cambió el vínculo.');
  }
  // Volver a comprobar toda la fila y los demás IDs justo antes de escribir K.
  const fresh=await readNative(token,request);
  const freshRows=fresh.details.map((v,i)=>Links.rowFromValues(v,i+2));
  const current=freshRows.find(r=>r.rowIdx===row.rowIdx);
  if(!current||!sameRow(current.expectedRow,payload.expectedRow))throw new Error('La fila cambió durante la revisión. No se guardó nada.');
  if(newId&&freshRows.some(other=>other.rowIdx!==row.rowIdx&&other.calEventId===newId))throw new Error('Otra fila ya usa ese evento. Recarga el análisis.');
  const range=`Detalle!K${row.rowIdx}`;
  await request(`${BASE}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,token,'PUT',{values:[[newId]]});
  const read=await request(`${BASE}/values/${encodeURIComponent(range)}`,token);
  if((read.values?.[0]?.[0]||'')!==newId)throw new Error('No se pudo verificar el vínculo guardado. Recarga el análisis.');
  return {rowIdx:row.rowIdx,previousId:row.calEventId,newEventId:newId,range,spreadsheetId:TEST_ID,calendarModified:false};
}
module.exports={runLinks};
