const {createHash}=require('node:crypto');
const S=require('./daily-service.cjs'),D=require('../locale-data.js'),L=require('../calendar-linking.js'),G=require('../group-identity.js');
const {snapshot}=require('./protected-service.cjs'),{targetId,validateTarget}=require('./policy.cjs'),{protectedReference}=require('./calendar-sync.cjs');
const CAL='https://www.googleapis.com/calendar/v3/calendars/primary/events',JOURNAL='Operaciones Calendar';
const uuid=id=>/^[a-f0-9-]{36}$/.test(id||'');
const copy=v=>JSON.parse(JSON.stringify(v));
const conflict=message=>Object.assign(Error(message),{conflict:true});
const closed=(meta,id)=>meta.developerMetadata.some(m=>['horas_calendar_done_','horas_calendar_cancelled_'].some(prefix=>m.metadataKey===prefix+id));
const base=()=>`https://sheets.googleapis.com/v4/spreadsheets/${targetId()}`;
const cell=value=>({userEnteredValue:{stringValue:value}});
const eventId=(id,index)=>'horas'+createHash('sha256').update(`${targetId()}|${id}|${index}`).digest('hex');
const signature=e=>S.hash({id:e.id,etag:e.etag,status:e.status||'confirmed',summary:e.summary||'',location:e.location||'',colorId:e.colorId,start:e.start,end:e.end,recurrence:e.recurrence});
function madridInstant(date,time){
  const wanted=date+'T'+time,naive=Date.parse(wanted+':00Z');let instant=naive;
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const local=()=>{const p=format.formatToParts(new Date(instant)),v=k=>p.find(p=>p.type===k).value;return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;};
  for(let i=0;i<4&&local()!==wanted;i++)instant-=Date.parse(local()+':00Z')-naive;
  if(local()!==wanted)throw Error('Ese horario no existe en Madrid por el cambio de hora. Elige otro horario.');
  return new Date(instant).toISOString();
}
function resource(s){
  if(!s.date||!s.start||!s.end)throw Error('Para guardar en Calendar indica fecha, hora de inicio y hora de fin.');
  return {summary:(s.gig?'Bolo ':'Clases ')+G.label(s.group,s.date),colorId:'5',location:s.address||'',start:{dateTime:madridInstant(s.date,s.start),timeZone:'Europe/Madrid'},end:{dateTime:madridInstant(s.date,s.end),timeZone:'Europe/Madrid'}};
}
function matches(e,wanted){
  const h=L.hours(e),date=L.calendarDate(e),desired=L.calendarDate(wanted),hours=L.hours(wanted);
  return e.status!=='cancelled'&&String(e.colorId)==='5'&&(e.summary||'')===wanted.summary&&(e.location||'')===wanted.location&&date===desired&&L.calendarDate({start:e.end})===L.calendarDate({start:wanted.end})&&h.horaInicio===hours.horaInicio&&h.horaFin===hours.horaFin;
}
async function getEvent(id,token,request){try{const e=await request(`${CAL}/${encodeURIComponent(id)}`,token);if(e?.id!==id)throw Error('Google no devolvió el evento solicitado.');return e.status==='cancelled'?null:e;}catch(error){if([404,410].includes(error.status))return null;throw error;}}
const descriptor=row=>({group:String(D.value(row[8])),date:D.dateISO(row[5]),start:D.time(D.value(row[12])),end:D.time(D.value(row[13])),price:D.numeric(D.value(row[4])),total:D.numeric(D.value(row[6])),district:String(D.value(row[9])),address:String(D.value(row[11])),gig:['X',true].includes(D.value(row[2])),calendarId:String(D.value(row[10]))});
async function linked(row,rowIdx,snap,token,request,warnings){
  const s=descriptor(row),id=s.calendarId;if(!id)return null;
  if(protectedReference(id)||snap.rows.filter(r=>String(D.value(r?.[10]))===id).length!==1){warnings.push('Referencia histórica o evento compartido: solo se modifica esta partida en la hoja.');return null;}
  const event=await getEvent(id,token,request);if(!event)return null;
  if(event.recurrence?.length||!L.compatible({grupo:s.group,fechaStr:D.display(s.date),horaInicio:s.start,horaFin:s.end},event))throw Error('El enlace no coincide con una sesión amarilla única. Sincroniza o revisa el vínculo antes de modificar Calendar.');
  return event;
}
async function prepare(p,snap,meta,token,request){
  const summary=[],warnings=[],calendarOps=[];let before=null,after=null,rowIdx=0,duplicates=0;
  const input=p.input||{};
  async function workEvents(dates){
    const sorted=[...dates].sort(),from=new Date(Date.parse(sorted[0]+'T00:00:00Z')-86400000),until=new Date(Date.parse(sorted.at(-1)+'T00:00:00Z')+2*86400000);
    return (await L.listAll(params=>request(`${CAL}?${new URLSearchParams(params)}`,token),{timeMin:from.toISOString(),timeMax:until.toISOString(),singleEvents:true,orderBy:'startTime'})).items;
  }
  const pendingIds=await pendingCalendarIds(meta,token,request);
  function chooseEvent(s,events){
    const matches=events.filter(e=>L.compatible({grupo:s.group,fechaStr:D.display(s.date),horaInicio:s.start,horaFin:s.end},e));
    if(matches.length>1)throw Error('Hay varios eventos amarillos con el mismo grupo, fecha y horario. Revisa Calendar antes de crear otro.');
    const event=matches[0];if(event&&(protectedReference(event.id)||pendingIds.has(event.id)||event.recurrence?.length))throw Error('El evento coincidente tiene un vínculo histórico, una serie completa o un cambio pendiente. Revisa ese vínculo o completa primero el cambio.');
    return event;
  }
  if(p.kind==='session'||p.kind==='edit'){
    if(typeof input.calendar!=='boolean')throw Error('Indica si quieres guardar también en Calendar.');
    const {calendar,rowIdx:rowInput,...fields}=input;
    if(p.kind==='session'&&rowInput!==undefined||p.kind==='edit'&&(!Number.isInteger(rowInput)||rowInput<2||fields.repeat))throw Error('Sesión no válida. La edición afecta solo a una sesión.');
    const groups=snap.groups.slice(1).map(r=>({nombre:String(D.value(r?.[0]))})),s=S.session(fields,groups);
    if(p.kind==='session'){
      const dates=S.dates(s.date,fields.repeat),events=calendar?await workEvents(dates):[];
      for(const [i,date]of dates.entries()){
        const entry={...s,date},existing=snap.rows.slice(1).some(r=>G.same(D.value(r?.[8]),entry.group)&&D.dateISO(r?.[5])===entry.date&&D.time(D.value(r?.[12]))===entry.start&&D.time(D.value(r?.[13]))===entry.end);
        if(existing)duplicates++;
        if(calendar){
          resource(entry);const event=chooseEvent(entry,events);
          if(event){entry.calendarId=event.id;entry.reuseCalendar=true;entry.expectedLinks=snap.rows.filter(r=>String(D.value(r?.[10]))===event.id).length;warnings.push('Se usará el evento amarillo que ya existe, sin duplicarlo.');}
          else if(existing)warnings.push('La partida adicional se guardará solo en la hoja; no se duplicará ni recreará su evento.');
          else{entry.calendarId=eventId(p.operationId,i);calendarOps.push({action:'create',id:entry.calendarId,body:resource(entry)});}
        }
        summary.push(entry);
      }
    }else{
      rowIdx=rowInput;const row=snap.rows[rowIdx-1];if(!row||!D.value(row[8]))throw Error('La sesión ya no está disponible.');
      before=await S.rawRow(rowIdx,token,request);if(S.hash(S.values(before))!==S.hash(S.values(row)))throw Error('La fila cambió al preparar la edición.');
      const old=descriptor(row);s.calendarId=old.calendarId;
      if(calendar){
        let event=await linked(row,rowIdx,snap,token,request,warnings);
        if(!warnings.length){
          if(!event){event=chooseEvent(s,await workEvents([s.date]));if(event)s.calendarId=event.id;}
          if(event){
            if(snap.rows.some((r,i)=>i!==rowIdx-1&&String(D.value(r?.[10]))===event.id))warnings.push('Se enlazará el evento compartido, conservando sus datos de Calendar.');
            else{const body=resource(s);if(G.same(old.group,s.group)&&old.gig===s.gig)body.summary=event.summary;if(!matches(event,body))calendarOps.push({action:'patch',id:event.id,before:signature(event),etag:event.etag,body});}
          }
          else{s.calendarId=eventId(p.operationId,0);calendarOps.push({action:'create',id:s.calendarId,body:resource(s)});}
        }
      }
      after=copy(before);const desired=S.rowFor(s),changedSchedule=['group','date','start','end','district','address'].some(k=>old[k]!==s[k]);
      const formula=row[6]?.userEnteredValue?.formulaValue,safe=new RegExp('^=\\s*\\$?E\\$?'+rowIdx+'\\s*\\*\\s*\\$?H\\$?'+rowIdx+'\\s*$','i');
      if(changedSchedule&&s.price===old.price&&s.total===old.total&&(row[4]?.userEnteredValue?.formulaValue||(formula&&!safe.test(formula))))throw Error('El importe depende de una fórmula especial. Revisa el importe antes de cambiar los datos de esta sesión.');
      const columns={2:old.gig!==s.gig,3:old.gig!==s.gig,4:old.price!==s.price,5:old.date!==s.date,6:old.total!==s.total,8:!G.same(old.group,s.group),9:old.district!==s.district,10:old.calendarId!==s.calendarId,11:old.address!==s.address,12:old.start!==s.start,13:old.end!==s.end};
      for(const [column,change]of Object.entries(columns))if(change){const i=Number(column);after[i].userEnteredValue=desired[i].userEnteredValue;if([5,12,13].includes(i))after[i].userEnteredFormat={...after[i].userEnteredFormat,numberFormat:desired[i].userEnteredFormat.numberFormat};}
      summary.push(s);
    }
  }else if(p.kind==='delete'){
    if(Object.keys(input).some(k=>k!=='rowIdx')||!Number.isInteger(input.rowIdx)||input.rowIdx<2)throw Error('Fila no válida.');
    rowIdx=input.rowIdx;const row=snap.rows[rowIdx-1];if(!row||!D.value(row[8]))throw Error('La sesión ya no está disponible.');before=await S.rawRow(rowIdx,token,request);
    if(S.hash(S.values(before))!==S.hash(S.values(row)))throw Error('La fila cambió al preparar el borrado.');
    summary.push(descriptor(row));const event=await linked(row,rowIdx,snap,token,request,warnings);
    if(event)calendarOps.push({action:'delete',id:event.id,before:signature(event),etag:event.etag});
  }else if(p.kind==='restore'){
    if(Object.keys(input).some(k=>k!=='operationId')||!uuid(input.operationId))throw Error('Archivo no válido.');
    const saved=(await S.trashRows(token,request,meta)).find(r=>r.operationId===input.operationId);if(!saved)throw Error('La sesión ya se restauró o no está archivada.');
    rowIdx=saved.rowIdx;before=await S.rawRow(rowIdx,token,request);if(S.values(before).some(v=>Object.keys(v).length))throw Error('La fila original contiene nuevos datos.');
    if(S.hash(before.map(({userEnteredValue,...rest})=>rest))!==S.hash(saved.cells.map(({userEnteredValue,...rest})=>rest)))throw Error('Los formatos o notas de la fila original cambiaron.');
    after=copy(saved.cells);const s=descriptor(after);
    if(s.calendarId&&!protectedReference(s.calendarId)&&!snap.rows.some(r=>String(D.value(r?.[10]))===s.calendarId)){
      const event=await getEvent(s.calendarId,token,request);
      if(!event){s.calendarId=eventId(p.operationId,0);after[10]=cell(s.calendarId);calendarOps.push({action:'create',id:s.calendarId,body:resource(s)});}
    }
    summary.push(s);
  }else throw Error('Operación de Calendar no permitida.');
  const core={kind:p.kind,input:p.input,rowIdx,before,after,summary,warnings,calendarOps,duplicates};
  return {...core,version:S.hash({...core,book:snap.rows.map(S.values),groups:snap.groups.map(S.values)})};
}
async function journals(meta,token,request){
  if(!meta.sheets.some(s=>s.properties.title===JOURNAL))return [];
  const data=await request(`${base()}/values/${encodeURIComponent(`'${JOURNAL}'!A:J`)}?valueRenderOption=UNFORMATTED_VALUE`,token);
  return (data.values||[]).filter(r=>uuid(r[0])).map(r=>{
    const json=r.slice(2).join('');if(meta.developerMetadata.find(m=>m.metadataKey==='horas_calendar_plan_'+r[0])?.metadataValue!==S.hash(json))throw Error('El registro de una operación pendiente cambió. Revisa la hoja.');
    const plan=JSON.parse(json);if(plan.operationId!==r[0]||plan.requestHash!==r[1])throw Error('Registro de Calendar no válido.');return plan;
  });
}
async function pendingCalendarIds(meta,token,request){
  const done=new Set(meta.developerMetadata.flatMap(m=>['horas_calendar_done_','horas_calendar_cancelled_'].filter(prefix=>m.metadataKey.startsWith(prefix)).map(prefix=>m.metadataKey.slice(prefix.length))));
  if(!meta.developerMetadata.some(m=>m.metadataKey.startsWith('horas_calendar_plan_')&&!done.has(m.metadataKey.slice('horas_calendar_plan_'.length))))return new Set();
  return new Set((await journals(meta,token,request)).filter(p=>!done.has(p.operationId)).flatMap(p=>p.calendarOps.map(s=>s.id)));
}
async function persist(plan,meta,token,request){
  const json=JSON.stringify(plan);if(json.length>360000)throw Error('Demasiados datos para esta operación. Divide la repetición en varios lotes.');
  const chunks=[];for(let i=0;i<json.length;i+=45000)chunks.push(json.slice(i,i+45000));
  const requests=[];let sheetId=meta.sheets.find(s=>s.properties.title===JOURNAL)?.properties.sheetId;
  if(sheetId===undefined){sheetId=800000000+Math.floor(Math.random()*90000000);requests.push({addSheet:{properties:{sheetId,title:JOURNAL,hidden:true,gridProperties:{rowCount:100,columnCount:10}}}});}
  requests.push({appendCells:{sheetId,rows:[{values:[cell(plan.operationId),cell(plan.requestHash),...chunks.map(cell)]}],fields:'userEnteredValue'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:'horas_calendar_plan_'+plan.operationId,metadataValue:S.hash(json),visibility:'DOCUMENT',location:{sheetId}}}});
  await request(`${base()}:batchUpdate`,token,'POST',{requests});
}
async function calendarStep(step,operationId,token,request){
  let current=await getEvent(step.id,token,request);
  if(step.action==='create'){
    const valid=e=>e&&matches(e,step.body)&&e.extendedProperties?.private?.horasOperation===operationId&&e.extendedProperties?.private?.horasSheet===targetId();
    if(current){if(!valid(current))throw conflict('El identificador corresponde a un evento diferente. No se sobrescribirá.');return;}
    try{await request(CAL+'?sendUpdates=none',token,'POST',{id:step.id,...step.body,extendedProperties:{private:{horasOperation:operationId,horasSheet:targetId()}}});}
    catch(error){current=await getEvent(step.id,token,request);if(!valid(current))throw error;}
    current=await getEvent(step.id,token,request);if(!valid(current))throw Error('Falta verificar el evento creado. Reintenta esta misma operación.');return;
  }
  if(step.action==='delete'&&!current)return;
  if(step.action==='patch'&&current&&matches(current,step.body))return;
  if(!current||signature(current)!==step.before)throw conflict('El evento cambió en Calendar desde la revisión. Se conserva su versión actual. Sincroniza y abre una revisión nueva.');
  const headers=current.etag?{'If-Match':current.etag}:{};
  try{await request(`${CAL}/${encodeURIComponent(step.id)}?sendUpdates=none`,token,step.action==='delete'?'DELETE':'PATCH',step.body,headers);}
  catch(error){current=await getEvent(step.id,token,request);if(step.action==='delete'?!current:current&&matches(current,step.body))return;if(error.status===412)throw conflict('Google detectó un cambio simultáneo en el evento. Se conserva ese cambio. Sincroniza y abre una revisión nueva.');throw error;}
  current=await getEvent(step.id,token,request);if(step.action==='delete'?!!current:!current||!matches(current,step.body))throw Error('Falta verificar el cambio en Calendar. Reintenta esta misma operación.');
}
async function finish(plan,token,request){
  let meta=await S.metadata(token,request);
  if(meta.developerMetadata.some(m=>m.metadataKey==='horas_calendar_cancelled_'+plan.operationId))throw conflict('La revisión ha caducado por cambios en Google. Sincroniza y abre una revisión nueva.');
  if(meta.developerMetadata.some(m=>m.metadataKey==='horas_calendar_done_'+plan.operationId))return {alreadyApplied:true,calendarModified:plan.calendarOps.length>0};
  let snap=await snapshot(token,request);
  if(plan.before&&S.hash(S.values(snap.rows[plan.rowIdx-1]))!==S.hash(S.values(plan.before)))throw conflict('La fila de la hoja cambió. Se conserva su versión actual. Sincroniza y abre una revisión nueva.');
  if(plan.kind==='session')for(const s of plan.summary)if(s.calendarId&&snap.rows.filter(r=>String(D.value(r?.[10]))===s.calendarId).length!==(s.reuseCalendar?s.expectedLinks:0))throw conflict('El evento ya se incorporó a la hoja desde otra revisión. Sincroniza para comprobarlo.');
  let cursor=0;const completed=await Promise.allSettled(Array.from({length:Math.min(4,plan.calendarOps.length)},async()=>{while(cursor<plan.calendarOps.length)await calendarStep(plan.calendarOps[cursor++],plan.operationId,token,request);}));
  const failed=completed.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  const fresh=await snapshot(token,request);
  if(plan.before&&S.hash(S.values(fresh.rows[plan.rowIdx-1]))!==S.hash(S.values(plan.before)))throw conflict('Calendar está actualizado, pero la fila de la hoja cambió. Se conserva esa edición. Sincroniza y revisa de nuevo la sesión.');
  const requests=[];
  if(plan.kind==='session')requests.push({appendCells:{sheetId:0,rows:plan.summary.map(s=>({values:S.rowFor(s)})),fields:'userEnteredValue,userEnteredFormat.numberFormat,dataValidation'}});
  else if(plan.kind==='delete')await S.archiveRequests([{rowIdx:plan.rowIdx,operationId:plan.operationId}],fresh,meta,token,request,requests);
  else if(plan.kind==='restore'){
    requests.push({updateCells:{range:{sheetId:0,startRowIndex:plan.rowIdx-1,endRowIndex:plan.rowIdx,startColumnIndex:0,endColumnIndex:15},rows:[{values:plan.after}],fields:'userEnteredValue,userEnteredFormat,dataValidation,note'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:'horas_restored_'+plan.input.operationId,metadataValue:plan.operationId,visibility:'DOCUMENT',location:{sheetId:0}}}});
  }else{
    for(let i=0;i<15;i++)if(S.hash(plan.before[i]?.userEnteredValue||{})!==S.hash(plan.after[i]?.userEnteredValue||{}))requests.push({updateCells:{range:{sheetId:0,startRowIndex:plan.rowIdx-1,endRowIndex:plan.rowIdx,startColumnIndex:i,endColumnIndex:i+1},rows:[{values:[plan.after[i]]}],fields:'userEnteredValue'+([5,12,13].includes(i)?',userEnteredFormat.numberFormat':'')}});
  }
  requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:'horas_calendar_done_'+plan.operationId,metadataValue:plan.requestHash,visibility:'DOCUMENT',location:{sheetId:0}}}});
  await request(`${base()}:batchUpdate`,token,'POST',{requests});
  meta=await S.metadata(token,request);if(!meta.developerMetadata.some(m=>m.metadataKey==='horas_calendar_done_'+plan.operationId&&m.metadataValue===plan.requestHash))throw Error('Falta comprobar el guardado. Reintenta la misma operación.');
  snap=await snapshot(token,request);
  if(plan.kind==='delete'){
    if(S.values(snap.rows[plan.rowIdx-1]).some(v=>Object.keys(v).length)||!(await S.trashRows(token,request,meta)).some(r=>r.operationId===plan.operationId))throw Error('Falta verificar la retirada y su copia recuperable.');
  }else for(const expected of plan.kind==='session'?plan.summary.map(S.rowFor):[plan.after])if(!snap.rows.some(r=>S.hash(S.values(r))===S.hash(S.values(expected))))throw Error('Falta verificar la sesión guardada en la hoja.');
  return {saved:plan.summary.length,calendarModified:plan.calendarOps.length>0,operationId:plan.operationId,spreadsheetId:targetId()};
}
let pending=Promise.resolve();
async function runCalendarCrud(p,token,request){
  validateTarget(p.spreadsheetId);
  if(!['preview','apply','pending','resume'].includes(p.action)||Object.keys(p).some(k=>!['spreadsheetId','action','kind','input','operationId','expectedVersion','allowSimilar'].includes(k)))throw Error('Petición no válida.');
  if(p.action==='pending'){
    const meta=await S.metadata(token,request),hasPending=meta.developerMetadata.some(m=>m.metadataKey.startsWith('horas_calendar_plan_')&&!closed(meta,m.metadataKey.slice('horas_calendar_plan_'.length)));
    if(!hasPending)return {items:[]};
    return {items:(await journals(meta,token,request)).filter(r=>!closed(meta,r.operationId)).map(r=>({operationId:r.operationId,kind:r.kind,group:r.summary[0]?.group,date:r.summary[0]?.date,createdAt:r.createdAt}))};
  }
  if(!uuid(p.operationId))throw Error('Falta el identificador de operación.');
  if(p.action==='preview'){
    const snap=await snapshot(token,request),meta=await S.metadata(token,request),plan=await prepare(p,snap,meta,token,request);
    return {summary:plan.summary,skipped:[],duplicates:plan.duplicates,version:plan.version,calendarActions:plan.calendarOps.map(s=>s.action),warnings:plan.warnings};
  }
  const previous=pending;let unlock;pending=new Promise(r=>unlock=r);await previous;
  try{
    const meta=await S.metadata(token,request),saved=meta.developerMetadata.some(m=>m.metadataKey==='horas_calendar_plan_'+p.operationId)?await journals(meta,token,request):[],requestHash=S.hash({kind:p.kind,input:p.input,version:p.expectedVersion,allowSimilar:p.allowSimilar===true});
    let plan=saved.find(r=>r.operationId===p.operationId);
    if(p.action==='resume'){if(!plan)throw Error('No se encontró la operación pendiente.');}
    else{
      if(plan&&plan.requestHash!==requestHash)throw Error('El identificador ya corresponde a otra revisión.');
      if(!plan){
        const snap=await snapshot(token,request),prepared=await prepare(p,snap,meta,token,request);if(prepared.version!==p.expectedVersion)throw conflict('La hoja o Calendar cambió. Revisa de nuevo antes de guardar.');
        if(prepared.duplicates&&!p.allowSimilar)throw Error('Confirma la partida adicional antes de continuar.');
        plan={...prepared,operationId:p.operationId,requestHash,createdAt:new Date().toISOString()};await persist(plan,meta,token,request);
      }
    }
    try{return await finish(plan,token,request);}catch(error){
      if(error.conflict&&!closed(meta,plan.operationId))await request(`${base()}:batchUpdate`,token,'POST',{requests:[{createDeveloperMetadata:{developerMetadata:{metadataKey:'horas_calendar_cancelled_'+plan.operationId,metadataValue:plan.requestHash,visibility:'DOCUMENT',location:{sheetId:0}}}}]});
      throw error;
    }
  }catch(error){if(error.conflict)throw error;throw Error(error.message+' Si algún cambio ya llegó a Google, utiliza «Comprobar la misma operación» o «Completar cambios pendientes» para continuar sin duplicarlo.');}
  finally{unlock();}
}
module.exports={runCalendarCrud,eventId,resource,matches,pendingCalendarIds,JOURNAL};
