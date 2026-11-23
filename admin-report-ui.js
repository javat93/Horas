document.addEventListener('DOMContentLoaded',()=>{
const root=document.getElementById('admin-report-content'),status=document.getElementById('admin-report-status'),prepare=document.getElementById('admin-report-prepare'),controls=document.getElementById('admin-report-files'),panel=document.getElementById('admin-report-panel'),date=document.getElementById('admin-report-date'),previewPanel=document.getElementById('admin-report-preview');
let busy=false,urls=[];
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const say=(message,error=false)=>{status.textContent=message;status.setAttribute('role',error?'alert':'status');};
function icon(name){const el=node('i');el.dataset.lucide=name;el.setAttribute('aria-hidden','true');return el;}
function button(label,name,primary=false){const el=node('button');el.type='button';el.className='reports-file-action'+(primary?' reports-file-action-primary':'');el.append(icon(name),node('span',label));return el;}
function download(file,url){const a=node('a');a.href=url;a.download=file.name;a.click();}
function card(report,files){const el=node('article');el.className='admin-report-card';el.append(node('h3',report.title));if(files.length>1)el.append(node('p',files.length+' páginas'));files.forEach((file,index)=>{const url=URL.createObjectURL(file);urls.push(url);const link=node('a');link.href=url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Ampliar '+report.title+(files.length>1?' · página '+(index+1):''));const img=node('img');img.src=url;img.alt=report.title+' · página '+(index+1);link.append(img);el.append(link);});return el;}
function pdfControls(file){
 const url=URL.createObjectURL(file);urls.push(url);const buttons=[],canShare=typeof navigator.share==='function'&&navigator.canShare?.({files:[file]});
 if(canShare){const share=button('Compartir PDF','share-2',true);share.onclick=async()=>{if(busy)return;try{await navigator.share({title:'Administración - Galeta y Maracuyá',files:[file]});say('PDF entregado al menú de compartir.');}catch(error){if(error.name==='AbortError')say('Compartir cancelado. El PDF sigue preparado.');else say('Usa Descargar PDF y adjúntalo en WhatsApp.',true);}};buttons.push(share);}
 const save=button('Descargar PDF','download',!canShare);save.onclick=()=>{if(!busy)download(file,url);};
 const view=node('a');view.append(icon('eye'),node('span','Ver PDF'));view.href=url;view.target='_blank';view.rel='noopener';view.className='reports-file-action';
 buttons.push(view,save);controls.replaceChildren(...buttons);return !!canShare;
}
prepare.onclick=async()=>{
 if(busy)return;busy=true;prepare.disabled=true;prepare.classList.add('is-busy');panel.setAttribute('aria-busy','true');prepare.querySelector('span').textContent='Preparando…';controls.querySelectorAll('button').forEach(b=>b.disabled=true);say('Preparando las dos tablas…');
 try{
  await window.horasConfigReady;if(!await window.horasEnvironmentReady)throw Error('Recarga la aplicación para confirmar la conexión.');const token=window.horasAccessToken();if(!token)throw Error('Primero conecta Google.');
  const endpoint=new URL(CONFIG.DAILY_API_URL,location.href);endpoint.searchParams.set('api','adminReports');
  const response=await window.horasFetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,action:'preview'})});
  const data=await AppData.readResponse(response);if(data.spreadsheetId!==CONFIG.SPREADSHEET_ID||data.reports?.length!==2||data.readOnly!==true||!Number.isFinite(Date.parse(data.loadedAt)))throw Error('Respuesta de informes no reconocida.');
  const reports=AdminReportModel.definitions.map(def=>{const r=data.reports.find(r=>r.id===def.id);if(!r)throw Error('Falta una tabla.');return AdminReportModel.table(def,[r.headers,...r.rows]);});
  const files=await Promise.all(reports.map(r=>AdminReportImages.prepare(r,data.loadedAt))),pdf=await AdminReportPDF.createFile(files,data.loadedAt);
  urls.forEach(URL.revokeObjectURL);urls=[];root.replaceChildren(...reports.map((r,i)=>card(r,files[i])));const shareReady=pdfControls(pdf);panel.classList.add('reports-ready');previewPanel.hidden=false;date.hidden=false;date.textContent='Preparado el '+new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',dateStyle:'medium',timeStyle:'short'}).format(new Date(data.loadedAt));
  say(shareReady?'Tu PDF está listo para compartir.':'Descarga el PDF y adjúntalo en WhatsApp.');window.lucide?.createIcons();
 }catch(error){say(error.message+(urls.length?' Se conserva el PDF anterior con su fecha.':''),true);}
 finally{busy=false;prepare.disabled=false;prepare.classList.remove('is-busy');panel.setAttribute('aria-busy','false');prepare.querySelector('span').textContent=urls.length?'Actualizar PDF':'Preparar PDF';controls.querySelectorAll('button').forEach(b=>b.disabled=false);}
};
});
