const {createHash}=require('node:crypto');
const D=require('../locale-data.js'),L=require('../calendar-linking.js'),G=require('../group-identity.js');
const history=new Set(require('./calendar-history.json').eventHashes);
const protectedReference=id=>history.has(createHash('sha256').update(id).digest('hex'));
const value=(row,i)=>D.value(row?.[i]);
const rowKey=(group,date,start,end)=>[G.id(group),date,start,end].join('|');
async function reconcile(month,snap,events,token,request){
  const removals=[],moves=[],skipped=[],ids=new Map(),listed=new Map(events.map(e=>[e.id,e]));
  for(const row of snap.rows.slice(1)){const id=String(value(row,10));if(id)ids.set(id,(ids.get(id)||0)+1);}
  const selected=snap.rows.map((row,i)=>({row,rowIdx:i+1})).filter(({row,rowIdx})=>rowIdx>1&&value(row,8)&&value(row,10)&&(D.dateISO(row[5]).startsWith(month)||L.calendarDate(listed.get(String(value(row,10)))||{}).startsWith(month)));
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{while(cursor<selected.length){
    const {row,rowIdx}=selected[cursor++],id=String(value(row,10));
    const current={rowIdx,group:String(value(row,8)),date:D.dateISO(row[5]),start:D.time(value(row,12)),end:D.time(value(row,13)),total:D.numeric(value(row,6)),calendarId:id};
    const omit=reason=>skipped.push({title:current.group,date:current.date,rowIdx,reason});
    if(protectedReference(id)){omit('Referencia histórica protegida: se conserva');continue;}
    if(ids.get(id)!==1){omit('Evento compartido por varias partidas: se conservan');continue;}
    let event=listed.get(id);
    if(!event){
      try{event=await request(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}`,token);}
      catch(error){if([404,410].includes(error.status))event={id,status:'cancelled'};else throw error;}
    }
    if(!event||event.id!==id)throw Error('Google no permitió comprobar un evento. No se retirará ninguna sesión.');
    if(event.status==='cancelled'){removals.push({...current,reason:'El evento se ha eliminado de Calendar'});continue;}
    const date=L.calendarDate(event),h=L.hours(event);
    if(String(event.colorId)!=='5'||!L.groupMatches(event.summary,current.group,date)){
      omit('El evento existe, pero cambió de color o grupo: se conserva para revisión');continue;
    }
    if(!date||!h.horaInicio||!h.horaFin||h.horaFin<=h.horaInicio||L.calendarDate({start:event.end})!==date){omit('El evento existe, pero su fecha u horario requieren revisión');continue;}
    if(date===current.date&&h.horaInicio===current.start&&h.horaFin===current.end)continue;
    const formula=row[6]?.userEnteredValue?.formulaValue,safeFormula=new RegExp('^=\\s*\\$?E\\$?'+rowIdx+'\\s*\\*\\s*\\$?H\\$?'+rowIdx+'\\s*$','i');
    if([4,5,12,13].some(i=>row[i]?.userEnteredValue?.formulaValue)||(formula&&!safeFormula.test(formula))){omit('Fórmula especial: revisa el cambio de fecha y horario sin alterar su importe');continue;}
    const key=rowKey(current.group,date,h.horaInicio,h.horaFin);
    if(snap.rows.some((r,i)=>i!==rowIdx-1&&value(r,8)&&rowKey(String(value(r,8)),D.dateISO(r[5]),D.time(value(r,12)),D.time(value(r,13)))===key)){
      omit('Ya hay otra partida en la nueva fecha y horario: se conservan para revisión');continue;
    }
    moves.push({...current,date,start:h.horaInicio,end:h.horaFin,previous:{date:current.date,start:current.start,end:current.end}});
  }}));
  for(const list of [removals,moves,skipped])list.sort((a,b)=>a.rowIdx-b.rowIdx);
  return {removals,moves,skipped};
}
module.exports={reconcile,protectedReference};
