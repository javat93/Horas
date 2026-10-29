const P=require('../protected-review.js');
const L=require('../calendar-linking.js');
const {TEST_ID,validateTarget}=require('./policy.cjs');
const BASE=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`;
const CAL='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const D=require('../locale-data.js');
const G=require('../group-identity.js');
const {createHash}=require('node:crypto');
const fingerprint=cells=>createHash('sha256').update(P.version(cells)).digest('hex');
async function snapshot(token,request){
  const query=new URLSearchParams({includeGridData:'true',fields:'sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue,effectiveFormat(numberFormat)))))'});
  query.append('ranges','Detalle!A1:N3000');query.append('ranges','Coles!A1:E1220');
  const data=await request(`${BASE}?${query}`,token);
  function rows(title,width){const sheet=data.sheets?.find(s=>s.properties.title===title);if(!sheet)throw new Error(`No se pudo leer ${title}.`);const result=[];for(const grid of sheet.data||[]){for(const [i,row]of (grid.rowData||[]).entries())result[(grid.startRow||0)+i]=Array.from({length:width},(_,c)=>row.values?.[c]||{});}return result;}
  return {rows:rows('Detalle',14),groups:rows('Coles',5)};
}
async function build(payload,snap,token,request){
  if(!['edit','sync'].includes(payload.mode))throw new Error('Modo de revisión no permitido.');
  let selected;
  if(payload.mode==='sync'){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(payload.month||''))throw new Error('Selecciona un mes válido.');
    selected=snap.rows.map((cells,i)=>({cells,rowIdx:i+1})).filter(({cells,rowIdx})=>rowIdx>1&&D.dateISO(cells?.[5]).startsWith(payload.month));
  }else{
    if(!Number.isInteger(payload.rowIdx)||payload.rowIdx<2||payload.rowIdx>3000)throw new Error('Fila no válida.');
    const cells=snap.rows[payload.rowIdx-1];if(!cells||!P.text(cells[8]))throw new Error('No se encontró la sesión.');selected=[{cells,rowIdx:payload.rowIdx}];
  }
  const catalogVersion=fingerprint(snap.groups.flat());
  let events=[];
  if(payload.mode==='sync'&&selected.length){
    const [year,month]=payload.month.split('-').map(Number),start=new Date(Date.UTC(year,month-1,1)),end=new Date(Date.UTC(year,month,1));start.setUTCDate(start.getUTCDate()-1);end.setUTCDate(end.getUTCDate()+1);
    events=(await L.listAll(params=>request(`${CAL}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)])))}`,token),{timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:true,orderBy:'startTime'})).items;
  }
  const allRows=snap.rows.map((cells,i)=>({rowIdx:i+1,calEventId:P.text(cells?.[10])}));
  const plans=[];
  for(const {cells,rowIdx}of selected){
    const notes=[],proposal={};
    if(payload.mode==='edit'){
      const input=payload.proposal||{};
      if(Object.keys(input).some(k=>!['price','total','district','address','start','end'].includes(k)))throw new Error('Esta fase solo permite editar precio, importe, barrio, dirección y horario.');
      if(input.price!==undefined||input.total!==undefined){proposal.money={price:P.number(input.price),total:P.number(input.total)};}
      if(input.district!==undefined){if(typeof input.district!=='string'||input.district.length>500)throw new Error('Barrio no válido.');if(input.district.trim())proposal.district=input.district.trim();else notes.push('El barrio vacío no borrará el que ya existe.');}
      if(input.address!==undefined){if(typeof input.address!=='string'||input.address.length>1000)throw new Error('Dirección no válida.');if(input.address.trim())proposal.address=input.address.trim();else notes.push('La dirección vacía no borrará la que ya existe.');}
      if(input.start!==undefined||input.end!==undefined){const start=L.time(input.start),end=L.time(input.end);if(!start||!end||end<=start)throw new Error('Introduce un horario válido con fin posterior al inicio.');proposal.time={start,end};}
    }else{
      const groupName=L.normalize(P.text(cells[8]));
      const groups=snap.groups.slice(1).filter(g=>g&&G.same(P.text(g[0]),groupName));
      if(groups.length!==1)notes.push('Grupo sin una tarifa única en Coles: se conservan los importes y el barrio.');
      else{
        const group=groups[0],isBolo=P.text(cells[2])==='X',price=P.amount(group[isBolo?3:2]);
        if(price!==null)proposal.money={price,total:price};else notes.push('No hay una tarifa numérica: no se inventará un precio por defecto.');
        if(P.text(group[4]).trim())proposal.district=P.text(group[4]).trim();
        if(!P.text(cells[11]).trim()&&P.text(group[1]).trim()){proposal.address=P.text(group[1]).trim();notes.push('Dirección propuesta desde Coles porque la sesión no tiene dirección; requiere aceptar.');}
      }
      const id=P.text(cells[10]),claimed=id&&allRows.filter(r=>r.calEventId===id).length>1;
      const event=id&&!claimed?events.find(e=>e.id===id):null;
      if(claimed)notes.push('ID compartido: se conserva el horario; revisa el vínculo en fase 2.');
      else if(event&&String(event.colorId)==='5'&&event.status!=='cancelled'&&G.same(L.groupFromTitle(event.summary),groupName)&&L.calendarDate(event)===D.dateISO(cells[5])){
        const h=L.hours(event);if(h.horaInicio&&h.horaFin)proposal.time={start:h.horaInicio,end:h.horaFin};
        if(typeof event.location==='string'&&event.location.trim()&&event.location.length<=1000){proposal.address=event.location.trim();notes.push('Dirección propuesta desde la ubicación específica de este evento de Calendar; el barrio se revisa por separado.');}
      }else if(id)notes.push('El evento no aparece como amarillo y compatible en este mes: se conserva el horario y no se recrea.');
    }
    const plan=P.makePlan(rowIdx,cells,proposal,payload.mode==='edit'?'Formulario: barrio y dirección independientes':'Tarifa y barrio de Coles; dirección específica y horario de Calendar',notes);
    plan.date=D.display(D.dateISO(cells[5]));
    plan.group=G.label(plan.group,D.dateISO(cells[5]));
    plan.expectedVersion=fingerprint(cells);plans.push(plan);
  }
  return {plans,catalogVersion,mode:payload.mode,month:payload.month,spreadsheetId:TEST_ID,calendarReadOnly:true};
}
async function runProtected(payload,token,request){
  validateTarget(payload.spreadsheetId);
  if(!['preview','apply'].includes(payload.action))throw new Error('Acción no permitida.');
  const snap=await snapshot(token,request),review=await build(payload,snap,token,request);
  if(payload.action==='preview')return review;
  if(!Array.isArray(payload.decisions)||payload.decisions.length>review.plans.length)throw new Error('Decisiones no válidas.');
  if(payload.mode==='sync'&&payload.catalogVersion!==review.catalogVersion)throw new Error('El catálogo cambió desde la revisión. Vuelve a preparar la propuesta.');
  const seen=new Set(),requests=[],expected=[];
  for(const decision of payload.decisions){
    if(seen.has(decision.rowIdx))throw new Error('Fila repetida en la confirmación.');seen.add(decision.rowIdx);
    const plan=review.plans.find(p=>p.rowIdx===decision.rowIdx);
    if(!plan||decision.expectedVersion!==plan.expectedVersion||decision.proposalVersion!==plan.proposalVersion)throw new Error('La fila o la propuesta cambió. Vuelve a revisar antes de guardar.');
    const changes=P.changes(plan,decision.choices,snap.rows[plan.rowIdx-1]);
    for(const change of changes){
      const cell={userEnteredValue:change.value};if(change.timeFormat)cell.userEnteredFormat={numberFormat:{type:'TIME',pattern:'hh:mm'}};
      requests.push({updateCells:{range:{sheetId:0,startRowIndex:plan.rowIdx-1,endRowIndex:plan.rowIdx,startColumnIndex:change.column,endColumnIndex:change.column+1},rows:[{values:[cell]}],fields:'userEnteredValue'+(change.timeFormat?',userEnteredFormat.numberFormat':'')}});
      expected.push({rowIdx:plan.rowIdx,...change});
    }
  }
  if(!requests.length)return {unchanged:true,rowsChanged:0,cellsChanged:0,calendarModified:false};
  const fresh=await snapshot(token,request);
  if(payload.mode==='sync'&&fingerprint(fresh.groups.flat())!==review.catalogVersion)throw new Error('El catálogo cambió durante la confirmación. No se guardó nada.');
  for(const decision of payload.decisions)if(fingerprint(fresh.rows[decision.rowIdx-1]||[])!==decision.expectedVersion)throw new Error('Se editó una fila durante la confirmación. No se guardó nada.');
  await request(`${BASE}:batchUpdate`,token,'POST',{requests});
  const verified=await snapshot(token,request);
  for(const entry of expected)if(JSON.stringify(verified.rows[entry.rowIdx-1]?.[entry.column]?.userEnteredValue)!==JSON.stringify(entry.value))throw new Error('El cambio se envió pero no se pudo verificar. Recarga antes de reintentar.');
  return {rowsChanged:new Set(expected.map(e=>e.rowIdx)).size,cellsChanged:expected.length,calendarModified:false,spreadsheetId:TEST_ID};
}
module.exports={runProtected,snapshot,build};
