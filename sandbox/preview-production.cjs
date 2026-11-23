// Local visual preview only: no Google requests, credentials or real sheet writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createHandler}=require('../api/test.js'),C=require('../protected-config.js'),{fake,c}=require('./fixtures/daily.cjs');
const root=path.resolve(__dirname,'..'),port=Number(process.env.HORAS_PREVIEW_PORT||3011),origin=`http://localhost:${port}`;
const fixture=fake({calendarWrites:true});
for (const name of ['Slap Lunes', 'La Maquinista', 'Taller puntual', 'Grupo histórico']) fixture.grids.get(758405382).push([name, 'Ubicación de simulación', 24, 50, 'Simulación'].map(c));
fixture.grids.get(0)[0][14]=c('Realizado automático');
fixture.setEvents([{id:'visual-calendar-new',summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-05T18:00:00+01:00'},end:{dateTime:'2026-11-05T19:00:00+01:00'},location:'Dirección de prueba de Calendar'},{id:'visual-calendar-move',summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-06T18:00:00+01:00'},end:{dateTime:'2026-11-06T19:00:00+01:00'}}]);
fixture.grids.get(0).push([false,false,false,true,24,'02/11/2026',24,1,'Moli de finestrelles','Barrio de ejemplo','','Dirección de ejemplo','17:00','18:00',''].map(c));
for(const [id,date]of [['visual-calendar-move','03/11/2026'],['visual-calendar-deleted','04/11/2026']])fixture.grids.get(0).push([false,false,false,true,24,date,24,1,'Moli de finestrelles','Barrio de ejemplo',id,'Dirección de ejemplo','18:00','19:00',''].map(c));
const adminFixture=require('./fixtures/admin-reports.cjs').fixture();
const handler=createHandler({profile:'production',writeEnabled:true,calendarWriteEnabled:true,request:(...args)=>new URL(args[0]).searchParams.getAll('ranges').some(r=>r.startsWith("'Total Coles'"))?adminFixture.request(...args):fixture.request(...args)});
const { fixture: repertoireFixture, theme: repertoireTheme, id: repertoireId } = require('./fixtures/repertoire.cjs');
const repertoire = repertoireFixture({ groups: ['Slap Lunes', 'La Maquinista', 'Taller puntual', 'Grupo histórico', 'Moli de finestrelles'], rowCount: 30 });
const repertoireReady = (async () => {
  for (const [n, nombre] of [[1, 'Batucada'], [2, 'Sambareggae (Slap)']]) await repertoire.apply({ action: 'saveTheme', theme: repertoireTheme(n, { nombre, temaSlap: true }) });
  await repertoire.apply({ action: 'assignThemes', grupo: 'Slap Lunes', assignments: [1, 2].map(n => ({ id: repertoireId(100+n), temaId: repertoireId(n) })) });
  await repertoire.apply({ action: 'assignThemes', grupo: 'La Maquinista', assignments: [{ id: repertoireId(201), temaId: repertoireId(1) }] });
  repertoire.book.spreadsheetId = C.create('production').SPREADSHEET_ID;
  repertoire.book.sheets[0].properties.sheetId = 155111501;
  repertoire.book.sheets[1].properties.sheetId = 155111502;
})();
const templateHeaders=require('./template-service.cjs').HEADERS;
repertoire.book.sheets.push({properties:{sheetId:155111504,title:'PlantillasRepertorio',gridProperties:{rowCount:30,columnCount:5}},data:[{rowData:Array.from({length:30},(_,i)=>({values:i?Array.from({length:5},()=>({})):templateHeaders.map(v=>({userEnteredValue:{stringValue:v}}))}))}]});
const templateHandler=require('../api/plantillas.js').createHandler(repertoire.request);
let nextRepertoireFailure='';
const repertoireHandler = require('../api/repertorio.js').productionHandler({ request:async(...args)=>{if(nextRepertoireFailure==='quota'&&args[2]==='POST'){nextRepertoireFailure='';throw Object.assign(Error('Quota exceeded (simulada)'),{status:429});}return repertoire.request(...args);} });
const courseFixture = require('./fixtures/group-courses.cjs').fixture({ groups: ['Slap Lunes', 'La Maquinista', 'Taller puntual', 'Grupo histórico', 'Moli de finestrelles'] });
const courseHandler = require('../api/grupos-curso.js').createHandler({ request: courseFixture.request });
const files=new Set(['styles.css','locale-data.js','auth-session.js','app-data.js','group-identity.js','calendar-linking.js','protected-review.js','protected-config.js','sandbox/daily-editor.js','sandbox/panel.js','sandbox/performed-editor.js','sandbox/identity-review.js','sandbox/group-editor.js','sandbox/calendar-review.js','sandbox/protected-editor.js','sandbox/locale-editor.js','favicon.ico','manifest.json','icon-192.png','icon-512.png']);
files.add('map-picker.js');
files.add('map-picker.css');
files.add('app-ui.css');
files.add('app-ui.js');
files.add('informacion.css');
files.add('inicio.html');
files.add('privacidad.html');
files.add('condiciones.html');
for (const file of ['repertoire-model.js', 'repertoire-client.js', 'repertoire-integration.js', 'repertoire-integrated.css', 'sandbox/repertoire-ui.js', 'sandbox/repertoire.css', 'repertorio.html']) files.add(file);
for (const file of ['group-courses.js', 'group-courses-ui.js', 'group-courses.css']) files.add(file);
["config-bootstrap.js","repertoire-nav-init.js","app-main.js","app-views.js","app-forms.js","group-options.js","legacy-bindings.js","safe-html.js","app-release.js","google-requests.js","draft-vault.js","form-drafts.js","report-tools.js","report-ui.js","repertoire-templates.js","vendor/lucide.js","vendor/fullcalendar.js"].forEach(file=>files.add(file));
['reports-dialog.js','admin-report.css','admin-report-model.js','admin-report-images.js','admin-report-pdf.js','admin-report-ui.js','vendor/pdf-lib.min.js'].forEach(file=>files.add(file));
['design-system/tokens.css','design-system/components.css','design-system/legacy-bridge.css','design-system/group-courses.css','design-system/screens.css','design-system/presentation.js'].forEach(file=>files.add(file));
const server=http.createServer(async(req,res)=>{
  try{
    if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end();}
    const u=new URL(req.url,origin);
    if(u.pathname==='/api/preview-control'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const value=JSON.parse(body||'{}');if(!['quota','none'].includes(value.next))throw Error('Simulación no permitida.');nextRepertoireFailure=value.next;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({next:nextRepertoireFailure}));}
    if(u.pathname==='/api/grupos-curso'||u.pathname==='/api/plantillas'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)throw Error('Petición demasiado grande');}
      req.body=JSON.parse(body||'{}');req.query=Object.fromEntries(u.searchParams);req.headers.origin=undefined;
      res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res;};
      return await (u.pathname==='/api/plantillas'?templateHandler:courseHandler)(req,res);
    }
    if(u.pathname==='/api/repertorio'){
      await repertoireReady;
      let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)throw Error('Petición demasiado grande');}
      req.body=JSON.parse(body||'{}');req.query=Object.fromEntries(u.searchParams);req.headers.origin=undefined;
      res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res;};
      return await repertoireHandler(req,res);
    }
    if(u.pathname==='/api/production'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>250000)throw Error('Petición demasiado grande');}
      req.body=JSON.parse(body||'{}');req.query=Object.fromEntries(u.searchParams);req.headers.origin=undefined;
      res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res;};
      return await handler(req,res);
    }
    if(u.pathname==='/config.js'){
      const c={...C.create('production')};for(const [key,value]of Object.entries(c))if(key.endsWith('_API_URL'))c[key]=value.replace('https://horas-git-main-javat93s-projects.vercel.app',origin);
      res.setHeader('Content-Type','text/javascript');return res.end('const CONFIG=Object.freeze('+JSON.stringify(c)+');window.horasConfigReady=Promise.resolve();');
    }
    if(u.pathname==='/' || u.pathname==='/index.html'){
      let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
      html=html.replace(/<script src="config-bootstrap\.js[^"]*"><\/script>/,'<script src="/config.js"></script>');
      html=html.replace(/<script src="https:\/\/(accounts\.google|apis\.google)[^>]*><\/script>/g,'');
      html=html.replace(/window.onload = async \(\) => \{[\s\S]*?^        \};/m,"window.onload=async()=>{savedSession=()=>({read:()=>({token:'synthetic-token',expiresAt:Date.now()+3600000,expired:false})});window.horasAccessToken=()=> 'synthetic-token';window.horasFetch=(url,options)=>{if(new URL(url,location.origin).origin!==location.origin)throw Error('La vista local no permite peticiones a Google');return fetch(url,options);};await window.horasEnvironmentReady;await syncData(false,false);showGoogleConnection(true);lucide.createIcons();};");
      html=html.replace('<body class="pb-20">','<body class="pb-20"><p style="padding:12px;background:#dbeafe">Vista local del modo protegido · Sin conexión a Google ni datos personales</p>');
      res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
    }
    const name=u.pathname.slice(1);
    if(name==='app-main.js'){const text=fs.readFileSync(path.join(root,name),'utf8').replace(/window.onload = async \(\) => \{[\s\S]*?^        \};/m,"window.onload=async()=>{savedSession=()=>({read:()=>({token:'synthetic-token',expiresAt:Date.now()+3600000,expired:false})});window.horasAccessToken=()=> 'synthetic-token';window.horasFetch=(url,options)=>{if(new URL(url,location.origin).origin!==location.origin)throw Error('La vista local no permite peticiones a Google');return fetch(url,options);};await window.horasEnvironmentReady;await syncData(false,false);showGoogleConnection(true);lucide.createIcons();};");res.setHeader('Content-Type','text/javascript');return res.end(text);}
if(!files.has(name)&&name!=='review-ui.css'){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)));
  }catch(error){res.statusCode=500;res.end(error.message);}
});
if(require.main===module)server.listen(port,'127.0.0.1',()=>console.log('Vista protegida sin Google: '+origin));
module.exports=server;
