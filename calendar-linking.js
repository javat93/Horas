(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.CalendarLinking=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();}
  function groupFromTitle(value){return normalize(String(value||'').split(' - ')[0]).replace(/^bolo\s+/,'');}
  function dateKey(value){
    const match=String(value||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!match)return '';
    const [,d,m,y]=match.map(Number);const date=new Date(Date.UTC(y,m-1,d));
    if(date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d)return '';
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function calendarDate(event){
    if(event.start?.date)return event.start.date;
    if(!event.start?.dateTime)return '';
    const date=new Date(event.start.dateTime);if(Number.isNaN(+date))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const part=type=>parts.find(x=>x.type===type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function time(value){
    const match=String(value||'').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    return match&&Number(match[1])<24&&Number(match[2])<60?`${match[1].padStart(2,'0')}:${match[2]}`:'';
  }
  function hours(event){
    const format=value=>value&&!Number.isNaN(+new Date(value))?new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):'';
    return {horaInicio:format(event.start?.dateTime),horaFin:format(event.end?.dateTime)};
  }
  function compatible(row,event){
    if(!event?.id || String(event.colorId)!=='5' || event.status==='cancelled')return false;
    if(!normalize(row.grupo) || groupFromTitle(event.summary)!==normalize(row.grupo))return false;
    if(!dateKey(row.fechaStr) || calendarDate(event)!==dateKey(row.fechaStr))return false;
    const h=hours(event);
    return (!row.horaInicio || (time(row.horaInicio) && time(row.horaInicio)===h.horaInicio)) && (!row.horaFin || (time(row.horaFin) && time(row.horaFin)===h.horaFin));
  }
  function sharedIds(rows){
    const ids=new Map();for(const row of rows){if(!row.calEventId)continue;const list=ids.get(row.calEventId)||[];list.push(row);ids.set(row.calEventId,list);}
    return [...ids].filter(([,list])=>list.length>1).map(([id,rows])=>({id,rows}));
  }
  function assertUniqueLinks(rows){if(sharedIds(rows).length)throw new Error('Hay IDs de Calendar compartidos. Revisa las vinculaciones antes de sincronizar, editar o borrar.');}
  function eventKey(row){const date=dateKey(row.fechaStr),group=normalize(row.grupo);return date&&group?[date,group,time(row.horaInicio),time(row.horaFin)].join('|'):'';}
  function choose(row,events,rows=[]){
    const candidates=events.filter(event=>compatible(row,event)).map(event=>({...event,claimedBy:rows.filter(other=>other.rowIdx!==row.rowIdx && other.calEventId===event.id).map(other=>other.rowIdx)}));
    if(candidates.length!==1)return {status:candidates.length?'ambiguous':'unmatched',candidates};
    if(candidates[0].claimedBy.length)return {status:'claimed',candidates};
    return {status:'matched',id:candidates[0].id,...hours(candidates[0]),candidates};
  }
  async function listAll(list,params){
    const items=[];const seen=new Set();const tokens=new Set();let pageToken;
    do{
      const response=await list({...params,maxResults:2500,...(pageToken?{pageToken}:{})});
      const data=response.result||response;
      for(const event of data.items||[]){if(!event.id || seen.has(event.id))continue;seen.add(event.id);items.push(event);}
      pageToken=data.nextPageToken;
      if(pageToken && tokens.has(pageToken))throw new Error('Calendar repitió una página; no se aplicó una sincronización incompleta.');
      if(pageToken)tokens.add(pageToken);
    }while(pageToken);
    return {items};
  }
  function rowFromValues(values,rowIdx){return {rowIdx,fechaStr:values[5]||'',grupo:values[8]||'',calEventId:values[10]||'',horaInicio:values[12]||'',horaFin:values[13]||'',expectedRow:Array.from({length:14},(_,i)=>values[i]??'')};}
  return {normalize,groupFromTitle,dateKey,calendarDate,hours,time,compatible,sharedIds,assertUniqueLinks,eventKey,choose,listAll,rowFromValues};
});
