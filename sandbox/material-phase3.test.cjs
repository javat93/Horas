const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const P=require('../design-system/presentation.js'),G=require('../group-identity.js'),D=require('../locale-data.js'),SafeHTML=require('../safe-html.js');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'app-views.js'),'utf8');
function originalViews(){let value=source;for(const p of [...require('../projects/material-design/phase3-presentation.json').files['app-views.js']].reverse())value=value.replace(p.after,p.before);return value;}
function harness(code,events){
 const nodes={'filter-cobrados':{value:'all'},'filter-realizados':{value:'all'},'filter-grupo':{value:''},'lista-eventos':{innerHTML:''},calendar:{}},edits=[];let options;
 const context={eventos:events,grupos:[],calendar:null,document:{getElementById:id=>nodes[id]},window:{innerWidth:412},GroupIdentity:G,LocaleData:D,SafeHTML,lucide:{createIcons(){}},sessionGroupName:e=>e.grupo,openEditSesionModal:row=>edits.push(row),FullCalendar:{Calendar:class{constructor(el,value){options=value;}render(){}}}};
 vm.createContext(context);vm.runInContext(code,context);return{context,nodes,edits,options:()=>options};
}
const samples=()=>[{rowIdx:2,grupo:'Grupo <img src=x onerror=alert(1)>',fechaStr:'02/11/2026',fechaObj:new Date(2026,10,2),horaInicio:'17:00',horaFin:'18:00',pagado:true,realizado:true,boloCole:'X',total:24},{rowIdx:3,grupo:'Grupo de prueba',fechaStr:'03/11/2026',fechaObj:new Date(2026,10,3),horaInicio:'18:00',horaFin:'19:00',pagado:false,realizado:false,boloCole:'',total:24}];
test('phase 3 renders current session status and hours without changing filters or records',()=>{
 const events=samples(),before=JSON.stringify(events),h=harness(source,events);h.context.renderEventos();
 const html=h.nodes['lista-eventos'].innerHTML;
 assert(html.includes('17:00 – 18:00'));assert(html.includes('Pendiente de cobro'));assert(html.includes('Cobrado'));assert(html.includes('Marcar pendiente'));assert(html.includes('Marcar cobrado'));
 assert(html.includes('&lt;img'));assert(!html.includes('<img src=x'));assert(html.includes('data-ui-action="payment" data-row="2" data-state="false"'));assert(html.includes('data-ui-action="archive-session" data-row="3"'));
 h.nodes['filter-cobrados'].value='pendiente';h.context.renderEventos();assert(!h.nodes['lista-eventos'].innerHTML.includes('data-row="2"'));assert(h.nodes['lista-eventos'].innerHTML.includes('data-row="3"'));
 assert.equal(JSON.stringify(events),before);
});
test('phase 3 calendar keeps event times links callbacks and options; adds only visible payment text',()=>{
 const events=samples(),old=harness(originalViews(),events),current=harness(source,events);old.context.renderCalendar();current.context.renderCalendar();
 const normal=o=>JSON.parse(JSON.stringify({...o,events:o.events.map(({title,...rest})=>rest)}));
 assert.deepEqual(normal(current.options()),normal(old.options()));
 assert(current.options().events[0].title.endsWith('\nCobrado'));assert(current.options().events[1].title.endsWith('\nPendiente de cobro'));
 current.options().eventClick({event:{extendedProps:{rowIdx:3}}});assert.deepEqual(current.edits,[3]);
});
test('phase 3 connection indicator follows existing DOM states without authentication or transport',()=>{
 const badge={dataset:{},textContent:''},auth={dataset:{},hidden:false,classList:{contains:()=>false}},text={textContent:'Conectar Google'},nodes={'pm-google-state':badge,'auth-btn':auth,'auth-text':text};let update;const observations=[];
 class Observe{constructor(callback){update=callback;}observe(el,options){observations.push({el,options});}}
 P.mount({getElementById:id=>nodes[id]},Observe);assert.equal(badge.textContent,'Preparando Google');assert.equal(observations.length,2);
 auth.dataset.googleReady='true';update();assert.equal(badge.textContent,'Google sin conectar');
 auth.classList.contains=()=>true;update();assert.equal(badge.textContent,'Google conectado');assert.equal(badge.dataset.connection,'connected');
 auth.classList.contains=()=>false;text.textContent='Renovar conexión';update();assert.equal(badge.textContent,'Renovar Google');
});
