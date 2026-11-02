// Endpoints aislados de fase 1. No usan SPREADSHEET_ID del entorno de producción.
const { targetId, withProfile, SCOPES, validateTarget, validateOperation } = require('../sandbox/policy.cjs');
const { controlProbe, googleRequest } = require('../sandbox/server.cjs');
const {runLinks}=require('../sandbox/link-service.cjs');
const {runProtected}=require('../sandbox/protected-service.cjs');
const {runLocale}=require('../sandbox/locale-service.cjs');
const {runGroups}=require('../sandbox/group-service.cjs');
const {runState}=require('../sandbox/state-service.cjs');
const {runDaily}=require('../sandbox/daily-service.cjs');

const {scopedRequest,isReadAction}=require('../sandbox/protected-runtime.cjs');
function createHandler({profile='test',writeEnabled=profile==='test',automaticEnabled=true,request=googleRequest}={}){
 const upstream=scopedRequest(request,{writeEnabled});
 return (req,res)=>withProfile(profile,async()=>{
  const allowedOrigins = ['https://javat93.github.io','https://horas-git-main-javat93s-projects.vercel.app',`https://${req.headers.host}`];
  const origin=req.headers.origin;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Vary','Origin');
  if(origin && !allowedOrigins.includes(origin)) return res.status(403).json({error:'Origen no permitido.'});
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS')return res.status(204).end();
  const api=req.query?.api;
  if(req.method==='GET' && api==='environment')return res.json({mode:profile,protectedMode:true,writeEnabled,autoPerformedEnabled:automaticEnabled,phase:8,dailyOperations:true,stateReview:true,performedAutomation:true,addressReview:true,identityReview:true,groupReview:true,linkReview:true,protectedReview:true,localeReview:true,spreadsheetId:targetId(),spreadsheetName:profile==='production'?'Horas Fran':profile==='rehearsal'?'Ensayo protegido':'Horas Fran — PRUEBAS — 28-10-2026',calendarReadOnly:true,automaticWrites:writeEnabled&&automaticEnabled,appWrites:false});
  if(req.method==='GET' && api==='oauth')return res.json({client_id:'367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',scopes:SCOPES});
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  const payload=req.body || {};
  if(!automaticEnabled&&api==='state'&&payload.action==='autoPerformed')return res.status(403).json({error:'Realizado automático está pausado durante este ensayo.'});
  if(profile!=='test'&&(api==='control'||(api==='locale'&&payload.action==='check')))return res.status(403).json({error:'Las pruebas temporales solo están disponibles en la copia de pruebas.'});
  if(!writeEnabled&&!isReadAction(api,payload))return res.status(403).json({error:'Las escrituras protegidas aún no están activadas.'});
  try {
    if(['control','links','protected','locale','groups','state','daily'].includes(api))validateTarget(payload.spreadsheetId);
    else validateOperation(api,payload.method,payload.params);
  } catch(error){return res.status(403).json({error:error.message});}
  const token=req.headers.authorization;
  if(!token || !/^Bearer \S+$/.test(token))return res.status(401).json({error:'Conecta Google en la aplicación.'});
  try {
    if(api==='control')return res.json(await controlProbe(token));
    if(api==='links')return res.json(await runLinks(payload,token,upstream));
    if(api==='protected')return res.json(await runProtected(payload,token,upstream));
    if(api==='locale')return res.json(await runLocale(payload,token,upstream));
    if(api==='groups')return res.json(await runGroups(payload,token,upstream));
    if(api==='state')return res.json(await runState(payload,token,upstream));
    if(api==='daily')return res.json(await runDaily(payload,token,upstream));
    let url;
    if(api==='sheets'){
      const query=new URLSearchParams();
      for(const key of ['valueRenderOption','dateTimeRenderOption','majorDimension'])if(payload.params[key])query.set(key,payload.params[key]);
      url=`https://sheets.googleapis.com/v4/spreadsheets/${targetId()}/values/${encodeURIComponent(payload.params.range)}?${query}`;
    }else{
      const query=new URLSearchParams();
      for(const key of ['timeMin','timeMax','singleEvents','orderBy','pageToken','maxResults'])if(payload.params[key]!==undefined)query.set(key,payload.params[key]);
      url=`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`;
    }
    return res.json(await upstream(url,token));
  }catch(error){return res.status(502).json({error:error.message});}
 });
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
