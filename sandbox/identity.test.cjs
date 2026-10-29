const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../group-identity.js'),L=require('../calendar-linking.js'),D=require('../locale-data.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('un cole estable con alias exactos, sin confundir otros grupos',()=>{
  for(const name of ['Molí de finestrelles','Moli de finestrelles','Tramuntana','  MOLÍ DE   FINESTRELLES '])assert.equal(G.id(name),G.school.id);
  for(const other of ['Tramuntana Jr','Moli','Slap Martes',''])assert.equal(G.same(other,'Tramuntana'),false);
  assert.equal(G.matches('Moli de finestrelles','tramuntana'),true);assert.equal(G.matches('Tramuntana','molí'),true);
});
test('vigencia en el cambio de año y fechas desconocidas sin renombrar por suposición',()=>{
  assert.equal(G.label('Tramuntana','2025-12-31'),'Molí de finestrelles');assert.equal(G.label('Moli de finestrelles','2026-01-01'),'Tramuntana');
  assert.equal(G.label('Moli de finestrelles','2024-02-29'),'Molí de finestrelles');
  for(const bad of ['',null,'2025-02-29'])assert.equal(G.label('Moli de finestrelles',bad),'Moli de finestrelles');
});
test('resuelve la misma tarifa sin crear otro cole y bloquea catálogos duplicados',()=>{
  const catalog=[{nombre:'Moli de finestrelles',precio:24,precioBolo:80}];assert.equal(G.resolve(catalog,'Tramuntana'),catalog[0]);assert.equal(catalog.length,1);
  assert.throws(()=>G.resolve([...catalog,{nombre:'Tramuntana'}],'Molí de finestrelles'),/varias filas/);
});
test('ambos nombres comparten filtro, clave y total, sin sumar dos veces cada fila',()=>{
  const rows=[{grupo:'Moli de finestrelles',total:24},{grupo:'Tramuntana',total:80}];assert.deepEqual(G.totals(rows),[{id:G.school.id,name:'Tramuntana',sessions:2,total:104}]);
  const row={grupo:'Moli de finestrelles',fechaStr:'01/01/2026',horaInicio:'18:00',horaFin:'19:00'};assert.equal(L.eventKey(row),L.eventKey({...row,grupo:'Tramuntana'}));
});
test('alias no relaja color, fechas, horas, ID ocupado ni ambigüedad de Calendar',()=>{
  const row={rowIdx:2,grupo:'Tramuntana',fechaStr:'28/09/2026',horaInicio:'18:00',horaFin:'19:00'},event={id:'old',summary:'Moli de finestrelles',colorId:'5',start:{dateTime:'2026-09-28T18:00:00+02:00'},end:{dateTime:'2026-09-28T19:00:00+02:00'}};
  assert.equal(L.choose(row,[event]).status,'matched');assert.equal(L.choose(row,[event,{...event,id:'new',summary:'Tramuntana'}]).status,'ambiguous');
  assert.equal(L.choose(row,[event],[{rowIdx:3,calEventId:'old'}]).status,'claimed');
  for(const e of [{...event,colorId:'1'},{...event,status:'cancelled'},{...event,start:{dateTime:'2026-09-29T18:00:00+02:00'}},{...event,end:{dateTime:'2026-09-28T20:00:00+02:00'}}])assert.equal(L.choose(row,[e]).status,'unmatched');
});
test('formulario/lista muestran nombre por fecha y no cambian el grupo guardado',()=>{
  const functions=html.slice(html.indexOf('        function sessionGroupName('),html.indexOf('        function populateGroupFilter('));
  const context=vm.createContext({GroupIdentity:G,LocaleData:D,document:{getElementById:()=>({value:'2026-01-01'})}});vm.runInContext(functions,context);
  const old={grupo:'Moli de finestrelles',fechaStr:'31/12/2025'},recent={grupo:'Moli de finestrelles',fechaStr:'01/01/2026'};
  assert.equal(context.sessionGroupName(old),'Molí de finestrelles');assert.equal(context.sessionGroupName(recent),'Tramuntana');assert.equal(recent.grupo,'Moli de finestrelles');assert.equal(context.groupOptionName(old.grupo),'Tramuntana');
});
test('importación real conserva referencia del catálogo y no detecta el alias como cambio',async()=>{
  const processor=html.slice(html.indexOf('        async function processCalendarEvent('),html.indexOf('        // Función auxiliar para formatear tiempo'));
  const changes=html.slice(html.indexOf('        function hasEventChanges('),html.indexOf('        // Función para actualizar un registro existente'));
  const context=vm.createContext({GroupIdentity:G,grupos:[{nombre:'Moli de finestrelles',precio:24,precioBolo:80,ubicacion:'Sant Andreu',sitio:'Calle'}],extractHorasFromCalendarEvent:()=>({horaInicio:'18:00',horaFin:'19:00'})});vm.runInContext(processor+changes,context);
  const event={id:'example',summary:'Tramuntana',start:{dateTime:'2026-09-28T18:00:00+02:00'},end:{dateTime:'2026-09-28T19:00:00+02:00'}};
  const row=await context.processCalendarEvent(event);assert.equal(row[8],'Moli de finestrelles');assert.equal(row[4],24);assert.equal(row[7],1);
  const special=await context.processCalendarEvent({...event,location:'Calle específica del bolo, 80'});assert.equal(special[11],'Calle específica del bolo, 80');assert.equal(special[9],'Sant Andreu');assert.equal(row[11],'Calle');
  const alternate=[...row];alternate[8]='Tramuntana';assert.equal(context.hasEventChanges({...event,tempRow:row},alternate),false);
});
test('filtro real reúne años y alias una sola vez, con los dos nombres según fecha',()=>{
  const helper=html.slice(html.indexOf('        function sessionGroupName('),html.indexOf('        function groupOptionName('));
  const renderer=html.slice(html.indexOf('        function renderEventos('),html.indexOf('        function renderGrupos('));
  const fields={'lista-eventos':{},'filter-cobrados':{value:'all'},'filter-realizados':{value:'all'},'filter-grupo':{value:G.school.id}};
  const events=[{rowIdx:2,grupo:'Moli de finestrelles',fechaStr:'31/12/2025',total:24},{rowIdx:3,grupo:'Tramuntana',fechaStr:'01/01/2026',total:80},{rowIdx:4,grupo:'Slap Martes',fechaStr:'01/01/2026',total:22}];
  const context=vm.createContext({document:{getElementById:id=>fields[id]},eventos:events,GroupIdentity:G,LocaleData:D,lucide:{createIcons(){}}});vm.runInContext(helper+renderer,context);context.renderEventos();const result=fields['lista-eventos'].innerHTML;
  assert.equal((result.match(/openEditSesionModal/g)||[]).length,2);assert.match(result,/Molí de finestrelles/);assert.match(result,/Tramuntana/);assert(!result.includes('Slap Martes'));assert.equal(events.length,3);assert.equal(events[0].grupo,'Moli de finestrelles');
});
