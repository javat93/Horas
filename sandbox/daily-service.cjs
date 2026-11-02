const {createHash}=require('node:crypto');
const {TEST_ID,validateTarget}=require('./policy.cjs');
const {snapshot}=require('./protected-service.cjs');
const D=require('../locale-data.js'),G=require('../group-identity.js'),L=require('../calendar-linking.js');
const BASE=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`,CAL='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TRASH='Papelera Horas';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const values=row=>Array.from({length:15},(_,i)=>row?.[i]?.userEnteredValue||{});
const text=(v,max=1000)=>{if(typeof v!=='string'||v.length>max)throw Error('Texto no válido.');return v.trim();};
const money=v=>{const n=D.numeric(v);if(n===null||n<0)throw Error('Introduce un importe válido, sin tarifas por defecto.');return n;};
const cell=v=>v===''?{}:({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v)}});
const catalog=rows=>rows.slice(1).filter(r=>D.value(r?.[0])).map(r=>({nombre:String(D.value(r[0])),sitio:String(D.value(r[1])),precio:D.value(r[2]),precioBolo:D.value(r[3]),ubicacion:String(D.value(r[4]))}));
const key=r=>[G.id(D.value(r?.[8])),D.dateISO(r?.[5]),D.time(D.value(r?.[12])),D.time(D.value(r?.[13]))].join('|');
async function rawRow(rowIdx,token,request){
  const result=await request(`${BASE}?includeGridData=true&ranges=${encodeURIComponent(`Detalle!A${rowIdx}:O${rowIdx}`)}&fields=sheets(properties(sheetId,title),data(rowData(values(userEnteredValue,userEnteredFormat,dataValidation,note))))`,token);
  const sheet=result.sheets?.find(s=>s.properties?.sheetId===0&&s.properties?.title==='Detalle');if(!sheet)throw Error('No se pudo comprobar la fila de Detalle.');
  return Array.from({length:15},(_,i)=>sheet.data?.[0]?.rowData?.[0]?.values?.[i]||{});
}
function session(input,groups){
  if(!input||Object.keys(input).some(k=>!['group','date','start','end','price','total','district','address','gig','repeat'].includes(k)))throw Error('Campos de sesión no permitidos.');
  const group=G.resolve(groups,text(input.group,200));if(!group)throw Error('Selecciona un grupo del catálogo.');
  const date=D.validISO(input.date),start=L.time(input.start),end=L.time(input.end);
  if(!date||typeof input.gig!=='boolean'||(input.start&&!start)||(input.end&&!end)||!!start!==!!end||(start&&end<=start))throw Error('Fecha u horario no válido; inicio y fin deben pertenecer al mismo día.');
  const price=money(input.price),total=input.total===undefined?price:money(input.total);
  return {group:group.nombre,date,start,end,price,total,district:text(input.district||'',500),address:text(input.address||''),gig:input.gig,calendarId:''};
}
function dates(first,repeat){
  if(!repeat)return [first];
  if(Object.keys(repeat).some(k=>!['frequency','interval','until'].includes(k))||!['DAILY','WEEKLY','MONTHLY'].includes(repeat.frequency)||!Number.isInteger(repeat.interval)||repeat.interval<1||repeat.interval>12||!D.validISO(repeat.until)||repeat.until<first||D.serial(repeat.until)-D.serial(first)>366)throw Error('Repetición no válida; máximo un año y 100 sesiones.');
  const out=[];for(let i=0;i<400;i++){
    const d=new Date(first+'T12:00:00Z');
    if(repeat.frequency==='MONTHLY'){
      const target=d.getUTCMonth()+i*repeat.interval,day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(target);d.setUTCDate(day);
      if(d.getUTCDate()!==day)continue;
    }else d.setUTCDate(d.getUTCDate()+i*repeat.interval*(repeat.frequency==='WEEKLY'?7:1));
    const iso=d.toISOString().slice(0,10);if(iso>repeat.until)break;out.push(iso);if(out.length>100)throw Error('Máximo 100 sesiones por lote.');
  }return out;
}
function rowFor(s){
  const serialTime=t=>t?t.split(':').map(Number).reduce((h,m)=>h*60+m)/1440:'';
  const row=['','',s.gig?'X':'',s.gig?'':'X',s.price,D.serial(s.date),s.total,1,s.group,s.district,s.calendarId,s.address,serialTime(s.start),serialTime(s.end),''].map(cell);
  for(const i of [0,1,2,3])row[i].dataValidation={condition:{type:'BOOLEAN',values:[{userEnteredValue:'X'}]}};
  row[8].dataValidation={condition:{type:'ONE_OF_RANGE',values:[{userEnteredValue:'=Coles!$A$2:$A'}]},showCustomUi:true};
  for(const i of [12,13])row[i].userEnteredFormat={numberFormat:{type:'TIME',pattern:'hh:mm'}};
  row[5].userEnteredFormat={numberFormat:{type:'DATE',pattern:'dd/mm/yyyy'}};
  for(const i of [4,6])row[i].userEnteredFormat={numberFormat:{type:'CURRENCY',pattern:'#,##0.00" €"'}};
  row[7].userEnteredFormat={numberFormat:{type:'NUMBER',pattern:'0'}};return row;
}
async function metadata(token,request){
  const m=await request(`${BASE}?fields=properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties),developerMetadata),developerMetadata`,token);
  if(m.properties?.locale!=='es_ES'||m.properties?.timeZone!=='Europe/Madrid'||!m.sheets?.some(s=>s.properties.sheetId===0&&s.properties.title==='Detalle')||!m.sheets.some(s=>s.properties.sheetId===758405382&&s.properties.title==='Coles'))throw Error('Estructura o configuración de la hoja no reconocida.');
  const found=await request(`${BASE}/developerMetadata:search`,token,'POST',{dataFilters:[{developerMetadataLookup:{visibility:'DOCUMENT'}}]});
  m.developerMetadata=(found.matchedDeveloperMetadata||[]).map(r=>r.developerMetadata).filter(Boolean);return m;
}
async function trashRows(token,request,meta){
  const sheet=meta.sheets.find(s=>s.properties.title===TRASH);if(!sheet)return [];
  const result=await request(`${BASE}/values/${encodeURIComponent(`'${TRASH}'!A:E`)}?valueRenderOption=UNFORMATTED_VALUE`,token);
  return (result.values||[]).filter(r=>r[0]&&!meta.developerMetadata?.some(m=>m.metadataKey==='horas_restored_'+r[0])).map(r=>{
    let cells;try{cells=JSON.parse(r[3]);}catch{throw Error('La papelera contiene una fila no reconocida.');}
    const anchor=meta.developerMetadata?.find(m=>m.metadataKey==='horas_trash_'+r[0]);
    if(!Array.isArray(cells)||cells.length!==15||hash(cells)!==r[4]||anchor?.metadataValue!==r[4])throw Error('La copia archivada no coincide con su comprobación.');
    const range=anchor.location?.dimensionRange,start=range?.startIndex??0;
    if(!range||(range.sheetId??0)!==0||range.dimension!=='ROWS'||!Number.isInteger(start)||start<1||range.endIndex!==start+1)throw Error('No se encuentra la fila original de la papelera.');
    return {operationId:r[0],archivedAt:r[1],rowIdx:start+1,cells};
  });
}
async function build(p,snap,token,request,now){
  const groups=catalog(snap.groups),summary=[],skipped=[];let rows=[],sheetId=0,duplicates=0;
  if(p.kind==='group'){
    const v=p.input;if(!v||Object.keys(v).some(k=>!['name','address','price','gigPrice','district'].includes(k)))throw Error('Campos de grupo no válidos.');
    const name=text(v.name,200);if(!name||groups.some(g=>G.same(g.nombre,name)))throw Error('El grupo ya existe o el nombre está vacío. Molí y Tramuntana son el mismo cole.');
    const raw=[name,text(v.address||''),v.price===undefined||v.price===''?'':money(v.price),v.gigPrice===undefined||v.gigPrice===''?'':money(v.gigPrice),text(v.district||'',500)];
    rows=[raw.map(cell)];for(const i of [2,3])if(typeof raw[i]==='number')rows[0][i].userEnteredFormat={numberFormat:{type:'CURRENCY',pattern:'#,##0.00" €"'}};
    sheetId=758405382;summary.push({name,price:raw[2],gigPrice:raw[3],address:raw[1],district:raw[4]});
  }else if(p.kind==='session'){
    const s=session(p.input,groups),sessions=dates(s.date,p.input.repeat).map(date=>({...s,date}));
    for(const s of sessions){const row=rowFor(s);if(snap.rows.slice(1).some(r=>key(r)===key(row)))duplicates++;rows.push(row);summary.push(s);}
  }else if(p.kind==='import'){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.input?.month||'')||Object.keys(p.input).some(k=>k!=='month'))throw Error('Selecciona un mes válido.');
    const [y,m]=p.input.month.split('-').map(Number);if(y<1900||y>2100)throw Error('Año no válido.');
    const start=new Date(Date.UTC(y,m-1,1)-86400000),end=new Date(Date.UTC(y,m,1)+86400000);
    const events=(await L.listAll(params=>request(`${CAL}?${new URLSearchParams(params)}`,token),{timeMin:start.toISOString(),timeMax:end.toISOString(),singleEvents:true,orderBy:'startTime'})).items;
    const proposed=new Set();
    for(const e of events){
      if(String(e.colorId)!=='5'||e.status==='cancelled')continue;
      const date=L.calendarDate(e),h=L.hours(e);if(!date.startsWith(p.input.month)||!e.end?.dateTime||new Date(e.end.dateTime)<=now)continue;
      const matches=groups.filter(g=>L.groupMatches(e.summary,g.nombre,date));let reason='';
      if(matches.length!==1)reason='Grupo inexistente o ambiguo';
      else if(!h.horaInicio||!h.horaFin||h.horaFin<=h.horaInicio||L.calendarDate({start:e.end})!==date)reason='Horario sin inicio/fin seguro en el mismo día';
      else if(snap.rows.slice(1).some(r=>D.value(r?.[10])===e.id))reason='CalendarId ya registrado';
      if(reason){skipped.push({title:e.summary||'',date,reason});continue;}
      const g=matches[0],gig=/^bolo\b/i.test(e.summary||''),price=D.numeric(gig?g.precioBolo:g.precio);
      if(price===null||price<0){skipped.push({title:e.summary||'',date,reason:'Tarifa vacía o no numérica'});continue;}
      const s={group:g.nombre,date,start:h.horaInicio,end:h.horaFin,price,total:price,gig,district:g.ubicacion,address:text(e.location||g.sitio||''),calendarId:e.id},row=rowFor(s),k=key(row);
      if(proposed.has(k)||snap.rows.slice(1).some(r=>key(r)===k)){skipped.push({title:e.summary||'',date,reason:'Sesión con el mismo grupo, fecha y horario; se conserva la existente'});continue;}
      proposed.add(k);rows.push(row);summary.push(s);
    }if(rows.length>100)throw Error('Más de 100 candidatas. Divide la importación antes de continuar.');
  }else if(p.kind==='restore'){
    if(Object.keys(p.input||{}).some(k=>k!=='operationId')||typeof p.input?.operationId!=='string')throw Error('Archivo no válido.');
    const found=(await trashRows(token,request,await metadata(token,request))).find(r=>r.operationId===p.input.operationId);
    if(!found)throw Error('La sesión ya se restauró o no está archivada.');
    if(values(snap.rows[found.rowIdx-1]).some(v=>Object.keys(v).length))throw Error('La fila original contiene datos nuevos. No se sobrescribirán.');
    const target=await rawRow(found.rowIdx,token,request),attributes=cells=>cells.map(({userEnteredValue,...rest})=>rest);
    if(hash(attributes(target))!==hash(attributes(found.cells)))throw Error('Las notas, validaciones o formatos de la fila original cambiaron. Revisa antes de restaurar.');
    rows=[found.cells];summary.push({rowIdx:found.rowIdx,group:D.value(found.cells[8]),date:D.dateISO(found.cells[5]),total:D.value(found.cells[6])});
  }else if(p.kind==='delete'){
    if(!Number.isInteger(p.input?.rowIdx)||p.input.rowIdx<2||Object.keys(p.input).some(k=>k!=='rowIdx'))throw Error('Fila no válida.');
    const r=snap.rows[p.input.rowIdx-1];if(!r||!D.value(r[8]))throw Error('Sesión no encontrada.');
    summary.push({rowIdx:p.input.rowIdx,group:D.value(r[8]),date:D.dateISO(r[5]),total:D.value(r[6]),calendarId:D.value(r[10])});
  }else throw Error('Operación diaria no permitida.');
  const version=hash({kind:p.kind,input:p.input,rows,summary,skipped,book:snap.rows.map(values),groups:snap.groups.map(values)});
  return {kind:p.kind,rows,sheetId,summary,skipped,duplicates,version};
}
let pending=Promise.resolve();
async function runDaily(payload,token,request,now=new Date()){
  validateTarget(payload.spreadsheetId);
  if(payload.action==='trash'){
    if(Object.keys(payload).some(k=>!['spreadsheetId','action'].includes(k)))throw Error('Petición de papelera no válida.');
    return {items:(await trashRows(token,request,await metadata(token,request))).map(({cells,...r})=>({...r,group:D.value(cells[8]),date:D.dateISO(cells[5]),total:D.value(cells[6])})),spreadsheetId:TEST_ID};
  }
  if(!payload||Object.keys(payload).some(k=>!['spreadsheetId','action','kind','input','expectedVersion','operationId','allowSimilar'].includes(k))||!['preview','apply'].includes(payload.action))throw Error('Petición diaria no válida.');
  if(payload.action==='preview'){const snap=await snapshot(token,request);await metadata(token,request);const p=await build(payload,snap,token,request,now);return {...p,rows:undefined,spreadsheetId:TEST_ID,calendarModified:false};}
  if(!/^[a-f0-9-]{36}$/.test(payload.operationId||'')||typeof payload.expectedVersion!=='string'||(payload.allowSimilar!==undefined&&typeof payload.allowSimilar!=='boolean'))throw Error('Falta la revisión u operación válida.');
  const previous=pending;let unlock;pending=new Promise(r=>unlock=r);await previous;
  try{
    let meta=await metadata(token,request);
    const operationKey='horas_daily_'+payload.operationId,requestHash=hash({kind:payload.kind,input:payload.input,version:payload.expectedVersion,allowSimilar:payload.allowSimilar===true});
    const recorded=meta.developerMetadata?.find(m=>m.metadataKey===operationKey);
    if(recorded){if(recorded.metadataValue!==requestHash)throw Error('El identificador ya se usó para otra revisión.');return {alreadyApplied:true,spreadsheetId:TEST_ID,calendarModified:false};}
    const snap=await snapshot(token,request),p=await build(payload,snap,token,request,now);
    if(p.version!==payload.expectedVersion)throw Error('La hoja o Calendar cambió desde la revisión. Analiza de nuevo antes de guardar.');
    if(p.duplicates&&!payload.allowSimilar)throw Error('Hay sesiones con el mismo grupo, fecha y horario. Confirma expresamente una partida adicional.');
    if(!p.rows.length&&p.kind!=='delete')return {unchanged:true,spreadsheetId:TEST_ID,calendarModified:false};
    const fresh=await snapshot(token,request);if(hash({rows:fresh.rows.map(values),groups:fresh.groups.map(values)})!==hash({rows:snap.rows.map(values),groups:snap.groups.map(values)}))throw Error('La hoja se editó durante la confirmación. No se guardó nada.');
    const requests=[];
    if(p.kind==='delete'){
      await trashRows(token,request,meta);
      const rowIdx=payload.input.rowIdx,cells=await rawRow(rowIdx,token,request);
      if(hash(values(cells))!==hash(values(snap.rows[rowIdx-1])))throw Error('La fila cambió antes de archivarla.');
      const json=JSON.stringify(cells);if(json.length>45000)throw Error('Fila demasiado grande para la papelera.');
      let trash=meta.sheets.find(s=>s.properties.title===TRASH)?.properties.sheetId;
      if(trash===undefined){trash=900000000+Math.floor(Math.random()*100000000);requests.push({addSheet:{properties:{sheetId:trash,title:TRASH,hidden:true,gridProperties:{rowCount:100,columnCount:5}}}});}
      requests.push({appendCells:{sheetId:trash,rows:[{values:[cell(payload.operationId),cell(new Date().toISOString()),cell(rowIdx),cell(json),cell(hash(cells))]}],fields:'userEnteredValue'}});
      requests.push({updateCells:{range:{sheetId:0,startRowIndex:rowIdx-1,endRowIndex:rowIdx,startColumnIndex:0,endColumnIndex:15},rows:[{values:Array.from({length:15},()=>({}))}],fields:'userEnteredValue'}});
      requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:'horas_trash_'+payload.operationId,metadataValue:hash(cells),visibility:'DOCUMENT',location:{dimensionRange:{sheetId:0,dimension:'ROWS',startIndex:rowIdx-1,endIndex:rowIdx}}}}});
    }else if(p.kind==='restore'){
      const rowIdx=p.summary[0].rowIdx;
      requests.push({updateCells:{range:{sheetId:0,startRowIndex:rowIdx-1,endRowIndex:rowIdx,startColumnIndex:0,endColumnIndex:15},rows:[{values:p.rows[0]}],fields:'userEnteredValue,userEnteredFormat,dataValidation,note'}});
      requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:'horas_restored_'+payload.input.operationId,metadataValue:payload.operationId,visibility:'DOCUMENT',location:{sheetId:0}}}});
    }else requests.push({appendCells:{sheetId:p.sheetId,rows:p.rows.map(values=>({values})),fields:'userEnteredValue,userEnteredFormat.numberFormat,dataValidation'}});
    requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:operationKey,metadataValue:requestHash,visibility:'DOCUMENT',location:{sheetId:p.sheetId}}}});
    try{await request(`${BASE}:batchUpdate`,token,'POST',{requests});}catch(e){throw Error('Resultado de guardado incierto. Conserva esta revisión y comprueba antes de reintentar: '+e.message);}
    meta=await metadata(token,request);if(!meta.developerMetadata?.some(m=>m.metadataKey===operationKey&&m.metadataValue===requestHash))throw Error('Petición enviada; falta verificarla. No crees otra revisión.');
    const after=await snapshot(token,request);
    if(p.kind==='delete'){
      if(values(after.rows[payload.input.rowIdx-1]).some(v=>Object.keys(v).length))throw Error('Archivado enviado, pero la fila no está vacía. Revisa antes de continuar.');
      if(!(await trashRows(token,request,meta)).some(r=>r.operationId===payload.operationId))throw Error('Falta verificar la copia de papelera. No repitas el borrado.');
    }
    else{
      const rows=p.sheetId===0?after.rows:after.groups;
      for(const planned of p.rows)if(!rows.some(r=>JSON.stringify(values(r).slice(0,planned.length))===JSON.stringify(planned.map(c=>c.userEnteredValue||{}))))throw Error('Alta enviada; falta verificar una fila. No repitas con una revisión nueva.');
    }
    return {saved:p.kind==='delete'?1:p.rows.length,operationId:payload.operationId,archived:p.kind==='delete',spreadsheetId:TEST_ID,calendarModified:false};
  }finally{unlock();}
}
module.exports={runDaily,session,dates,rowFor,build,hash,values,metadata,trashRows,TRASH,BASE};
