// Endpoints aislados de fase 1. No usan SPREADSHEET_ID del entorno de producción.
const { TEST_ID, SCOPES, validateTarget, validateOperation } = require('../sandbox/policy.cjs');
const { controlProbe, googleRequest } = require('../sandbox/server.cjs');

module.exports = async (req,res) => {
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
  if(req.method==='GET' && api==='environment')return res.json({mode:'test',spreadsheetId:TEST_ID,spreadsheetName:'Horas Fran — PRUEBAS — 28-10-2026',calendarReadOnly:true,automaticWrites:false,appWrites:false});
  if(req.method==='GET' && api==='oauth')return res.json({client_id:'367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',scopes:SCOPES});
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  const payload=req.body || {};
  try {
    if(api==='control')validateTarget(payload.spreadsheetId);
    else validateOperation(api,payload.method,payload.params);
  } catch(error){return res.status(403).json({error:error.message});}
  const token=req.headers.authorization;
  if(!token || !/^Bearer \S+$/.test(token))return res.status(401).json({error:'Conecta Google en la aplicación de pruebas.'});
  try {
    if(api==='control')return res.json(await controlProbe(token));
    let url;
    if(api==='sheets'){
      const query=new URLSearchParams();
      for(const key of ['valueRenderOption','dateTimeRenderOption','majorDimension'])if(payload.params[key])query.set(key,payload.params[key]);
      url=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}/values/${encodeURIComponent(payload.params.range)}?${query}`;
    }else{
      const query=new URLSearchParams();
      for(const key of ['timeMin','timeMax','singleEvents','orderBy','pageToken','maxResults'])if(payload.params[key]!==undefined)query.set(key,payload.params[key]);
      url=`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`;
    }
    return res.json(await googleRequest(url,token));
  }catch(error){return res.status(502).json({error:error.message});}
};
