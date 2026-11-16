// Local visual preview only: no Google requests, credentials or real sheet writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createHandler}=require('../api/test.js'),C=require('../protected-config.js'),{fake,c}=require('./fixtures/daily.cjs');
const root=path.resolve(__dirname,'..'),port=Number(process.env.HORAS_PREVIEW_PORT||3011),origin=`http://localhost:${port}`;
const fixture=fake({calendarWrites:true});
fixture.grids.get(0)[0][14]=c('Realizado automático');
fixture.setEvents([{id:'visual-calendar-new',summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-05T18:00:00+01:00'},end:{dateTime:'2026-11-05T19:00:00+01:00'},location:'Dirección de prueba de Calendar'},{id:'visual-calendar-move',summary:'Clases Tramuntana',colorId:'5',start:{dateTime:'2026-11-06T18:00:00+01:00'},end:{dateTime:'2026-11-06T19:00:00+01:00'}}]);
fixture.grids.get(0).push([false,false,false,true,24,'02/11/2026',24,1,'Moli de finestrelles','Barrio de ejemplo','','Dirección de ejemplo','17:00','18:00',''].map(c));
for(const [id,date]of [['visual-calendar-move','03/11/2026'],['visual-calendar-deleted','04/11/2026']])fixture.grids.get(0).push([false,false,false,true,24,date,24,1,'Moli de finestrelles','Barrio de ejemplo',id,'Dirección de ejemplo','18:00','19:00',''].map(c));
const handler=createHandler({profile:'production',writeEnabled:true,calendarWriteEnabled:true,request:fixture.request});
const { fixture: repertoireFixture, theme: repertoireTheme, id: repertoireId } = require('./fixtures/repertoire.cjs');
const repertoire = repertoireFixture({ groups: ['Slap Lunes', 'La Maquinista'], rowCount: 30 });
const repertoireReady = (async () => {
  for (const [n, nombre] of [[1, 'Batucada'], [2, 'Sambareggae (Slap)']]) await repertoire.apply({ action: 'saveTheme', theme: repertoireTheme(n, { nombre, temaSlap: true }) });
  await repertoire.apply({ action: 'assignThemes', grupo: 'Slap Lunes', assignments: [1, 2].map(n => ({ id: repertoireId(100+n), temaId: repertoireId(n) })) });
  await repertoire.apply({ action: 'assignThemes', grupo: 'La Maquinista', assignments: [{ id: repertoireId(201), temaId: repertoireId(1) }] });
  repertoire.book.spreadsheetId = C.create('production').SPREADSHEET_ID;
  repertoire.book.sheets[0].properties.sheetId = 155111501;
  repertoire.book.sheets[1].properties.sheetId = 155111502;
})();
const repertoireHandler = require('../api/repertorio.js').productionHandler({ request: repertoire.request });
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
const server=http.createServer(async(req,res)=>{
  try{
    if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);return res.end();}
    const u=new URL(req.url,origin);
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
      res.setHeader('Content-Type','text/javascript');return res.end('const CONFIG=Object.freeze('+JSON.stringify(c)+');');
    }
    if(u.pathname==='/' || u.pathname==='/index.html'){
      let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
      html=html.replace(/<script>\s*\/\/ Detectar si estamos en producción[\s\S]*?<\/script>/,'<script src="/config.js"></script><script>window.horasConfigReady=Promise.resolve();</script>');
      html=html.replace(/<script src="https:\/\/(accounts\.google|apis\.google)[^>]*><\/script>/g,'');
      html=html.replace(/window.onload = async \(\) => \{[\s\S]*?^        \};/m,"window.onload=async()=>{savedSession=()=>({read:()=>({token:'synthetic-token',expiresAt:Date.now()+3600000,expired:false})});window.horasAccessToken=()=> 'synthetic-token';window.horasFetch=(url,options)=>{if(new URL(url,location.origin).origin!==location.origin)throw Error('La vista local no permite peticiones a Google');return fetch(url,options);};await window.horasEnvironmentReady;await syncData(false,false);showGoogleConnection(true);lucide.createIcons();};");
      html=html.replace('<body class="pb-20">','<body class="pb-20"><p style="padding:12px;background:#dbeafe">Vista local del modo protegido · Sin conexión a Google ni datos personales</p>');
      res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
    }
    const name=u.pathname.slice(1);if(!files.has(name)&&name!=='review-ui.css'){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)));
  }catch(error){res.statusCode=500;res.end(error.message);}
});
if(require.main===module)server.listen(port,'127.0.0.1',()=>console.log('Vista protegida sin Google: '+origin));
module.exports=server;
