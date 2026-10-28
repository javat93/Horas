const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { TEST_ID, SCOPES, validateTarget, validateOperation } = require('./policy.cjs');
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.HORAS_TEST_PORT || 3000);
const CLIENT_ID = '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com';

function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function readBody(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 65536) throw new Error('Petición demasiado grande.');
  }
  return JSON.parse(value || '{}');
}
async function googleRequest(url, token, method = 'GET', body, fetchImpl = fetch) {
  const response = await fetchImpl(url, { method, headers: { Authorization: token, 'Content-Type': 'application/json' }, ...(body ? {body: JSON.stringify(body)} : {}) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error=new Error(`Google ${response.status}: ${data.error?.message || 'Error en la petición'}`);
    error.status=response.status;throw error;
  }
  return data;
}
async function controlProbe(token, fetchImpl = fetch) {
  validateTarget(TEST_ID);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`;
  let sheetId;
  let cleaned = false;
  let probeError;
  let title;
  try {
    title = `Prueba aislamiento ${Date.now()}`;
    const added = await googleRequest(`${base}:batchUpdate`, token, 'POST', {requests:[{addSheet:{properties:{title,gridProperties:{rowCount:2,columnCount:2}}}}]}, fetchImpl);
    sheetId = added.replies?.[0]?.addSheet?.properties?.sheetId;
    if (!Number.isInteger(sheetId)) throw new Error('No se pudo verificar la pestaña temporal.');
    const range = encodeURIComponent(`'${title}'!A1`);
    await googleRequest(`${base}/values/${range}?valueInputOption=RAW`, token, 'PUT', {values:[[42]]}, fetchImpl);
    const read = await googleRequest(`${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, token, 'GET', null, fetchImpl);
    if (read.values?.[0]?.[0] !== 42) throw new Error('La lectura no coincide con la escritura de control.');
  } catch (error) { probeError = error; }
  finally {
    if (Number.isInteger(sheetId)) {
      try {
        await googleRequest(`${base}:batchUpdate`, token, 'POST', {requests:[{deleteSheet:{sheetId}}]}, fetchImpl);
        cleaned = true;
      } catch (error) {
        throw new Error(`No se pudo retirar la pestaña temporal «${title}» (${sheetId}). ${error.message}`);
      }
    }
  }
  if (probeError) throw probeError;
  return { spreadsheetId: TEST_ID, valueVerified:42, restored:cleaned, calendarModified:false };
}
function testConfig(origin) {
  return `const CONFIG = Object.freeze(${JSON.stringify({
    API_KEY:null, CLIENT_ID, SPREADSHEET_ID:TEST_ID, SCOPES,
    DISCOVERY_DOCS:['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest','https://sheets.googleapis.com/$discovery/rest?version=v4'],
    PROXY_URL:origin,GOOGLE_SHEETS_API_URL:`${origin}/api/sheets`,GOOGLE_CALENDAR_API_URL:`${origin}/api/calendar`,
    USE_PROXY:true,ENVIRONMENT:'production',TEST_MODE:true,TEST_PHASE:2,CALENDAR_LINKS_API_URL:`${origin}/api/test-links`
  })});`;
}
function testPage() {
  let html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const loader = /<script>\s*\/\/ Detectar si estamos en producción[\s\S]*?<\/script>/;
  if (!loader.test(html)) throw new Error('Ha cambiado el cargador de configuración. No se inicia el entorno de pruebas.');
  html = html.replace(loader, '<script src="/sandbox/config.js"></script>');
  return html;
}
function createServer(fetchImpl = fetch) {
  return http.createServer(async (req,res) => {
    try {
      const actualPort = req.socket.localPort;
      const origin = `http://localhost:${actualPort}`;
      const allowedHosts = new Set([`localhost:${actualPort}`,`127.0.0.1:${actualPort}`]);
      if (!allowedHosts.has(req.headers.host) || (req.headers.origin && ![origin,`http://127.0.0.1:${actualPort}`].includes(req.headers.origin))) return send(res,403,{error:'Origen no permitido.'});
      const url = new URL(req.url,origin);
      if (req.method === 'GET' && url.pathname === '/api/test-environment') return send(res,200,{mode:'test',phase:2,linkReview:true,spreadsheetId:TEST_ID,spreadsheetName:'Horas Fran — PRUEBAS — 28-10-2026',calendarReadOnly:true,automaticWrites:false,appWrites:false});
      if (req.method === 'GET' && url.pathname === '/api/oauth-config') return send(res,200,{client_id:CLIENT_ID,scopes:SCOPES});
      if (req.method === 'POST' && ['/api/sheets','/api/calendar','/api/test-control','/api/test-links'].includes(url.pathname)) {
        const payload = await readBody(req);
        // Rechazar operaciones peligrosas antes de autenticación y antes de cualquier llamada remota.
        try {
          if (['/api/test-control','/api/test-links'].includes(url.pathname)) validateTarget(payload.spreadsheetId);
          else validateOperation(url.pathname.slice(5),payload.method,payload.params);
        } catch (error) { return send(res,403,{error:error.message}); }
        const token = req.headers.authorization;
        if (!token || !/^Bearer \S+$/.test(token)) return send(res,401,{error:'Conecta Google desde la aplicación de pruebas.'});
        if (url.pathname === '/api/test-control') return send(res,200,await controlProbe(token,fetchImpl));
        if (url.pathname === '/api/test-links') return send(res,200,await require('./link-service.cjs').runLinks(payload,token,(url,token,method='GET',body)=>googleRequest(url,token,method,body,fetchImpl)));
        let upstream;
        if (url.pathname === '/api/sheets') {
          const query = new URLSearchParams();
          for (const key of ['valueRenderOption','dateTimeRenderOption','majorDimension']) if (payload.params[key]) query.set(key,payload.params[key]);
          upstream = `https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}/values/${encodeURIComponent(payload.params.range)}?${query}`;
        } else {
          const query = new URLSearchParams();
          for (const key of ['timeMin','timeMax','singleEvents','orderBy','pageToken','maxResults']) if (payload.params[key] !== undefined) query.set(key,payload.params[key]);
          upstream = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`;
        }
        return send(res,200,await googleRequest(upstream,token,'GET',null,fetchImpl));
      }
      if (req.method !== 'GET') return send(res,405,{error:'Método no permitido.'});
      if (['/','/index.html','/pruebas'].includes(url.pathname)) {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}); return res.end(testPage());
      }
      if (url.pathname === '/sandbox/config.js') {
        const actualOrigin = `http://${req.headers.host}`;
        res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}); return res.end(testConfig(actualOrigin));
      }
      const files = {'/calendar-linking.js':['calendar-linking.js','text/javascript'],'/sandbox/calendar-review.js':['sandbox/calendar-review.js','text/javascript'],'/sandbox/panel.js':['sandbox/panel.js','text/javascript'],'/styles.css':['styles.css','text/css'],'/favicon.ico':['favicon.ico','image/x-icon'],'/icon-192.png':['icon-192.png','image/png'],'/icon-512.png':['icon-512.png','image/png'],'/app-version.js':['app-version.js','text/javascript']};
      const file=files[url.pathname];
      if (!file) return send(res,404,{error:'Recurso no disponible en pruebas.'});
      res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-store'}); res.end(fs.readFileSync(path.join(ROOT,file[0])));
    } catch (error) { send(res,502,{error:error.message}); }
  });
}
if (require.main === module) {
  const server=createServer();
  server.listen(PORT,'127.0.0.1',()=>console.log(`Pruebas: http://localhost:${PORT}/pruebas\nHoja exclusiva: ${TEST_ID}\nCalendar: solo lectura. Escrituras automáticas: bloqueadas.`));
}
module.exports={createServer,controlProbe,testPage,testConfig,googleRequest};
