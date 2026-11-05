const {targetId}=require('./policy.cjs');
// No ID comes from a request. The selected release profile owns every upstream URL.
function scopedRequest(request,{writeEnabled=false,calendarWriteEnabled=false}={}){
  return async(url,token,method='GET',body,headers)=>{
    const u=new URL(url),base=`/v4/spreadsheets/${targetId()}`;
    const sheet=u.origin==='https://sheets.googleapis.com'&&(u.pathname===base||u.pathname.startsWith(base+'/')||u.pathname===base+':batchUpdate');
    const calendar=u.origin==='https://www.googleapis.com'&&(u.pathname==='/calendar/v3/calendars/primary/events'||u.pathname.startsWith('/calendar/v3/calendars/primary/events/'));
    if(!sheet&&!calendar)throw Error('Destino remoto fuera del perfil protegido.');
    const metadataRead=sheet&&method==='POST'&&u.pathname===base+'/developerMetadata:search';
    if(calendar&&method!=='GET'){
      if(!writeEnabled||!calendarWriteEnabled)throw Error('Calendar está en modo de solo lectura.');
      const collection=u.pathname==='/calendar/v3/calendars/primary/events';
      if(!(method==='POST'&&collection||['PATCH','DELETE'].includes(method)&&!collection))throw Error('Operación de Calendar no permitida.');
    }
    if(sheet&&method!=='GET'&&!metadataRead&&!writeEnabled)throw Error('Las escrituras protegidas aún no están activadas.');
    if(sheet&&!['GET','POST','PUT'].includes(method))throw Error('Método de Sheets bloqueado.');
    return request(url,token,method,body,headers);
  };
}
function releaseSettings(env){
  const profile=env.HORAS_PROTECTED_PROFILE;
  if(!['rehearsal','production'].includes(profile))throw Error('El modo protegido de producción está pendiente de activación.');
  if(profile==='production'&&env.HORAS_MIGRATION_VERIFIED!=='migracion-20261102')throw Error('Falta verificar la migración antes de habilitar la hoja real.');
  const settings={profile,writeEnabled:env.HORAS_PROTECTED_WRITES==='enabled'};
  if(env.HORAS_CALENDAR_WRITES==='enabled'&&profile==='production'&&settings.writeEnabled)settings.calendarWriteEnabled=true;
  return settings;
}
const readActions={links:['audit','candidates'],protected:['preview'],locale:['data','audit','numbersAudit'],groups:['audit','preview'],daily:['preview','trash','pending'],state:['getPayment']};
function isReadAction(api,payload){return api==='sheets'||api==='calendar'||readActions[api]?.includes(payload.action)===true;}
module.exports={scopedRequest,releaseSettings,isReadAction};
