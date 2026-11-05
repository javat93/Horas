(function(){
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const currency=value=>value===null?'Sin importe numérico':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
  const groupLabel=(name,date)=>typeof GroupIdentity==='undefined'?name:GroupIdentity.label(name,date);
  let working=false,monthInput;
  async function api(payload){
    if(!await window.horasEnvironmentReady)throw new Error('El entorno protegido no está verificado.');
    const token=window.horasAccessToken?.();if(!token)throw new Error('Primero conecta Google.');
    const response=await (window.horasFetch||fetch)(CONFIG.PROTECTED_REVIEW_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,...payload})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo preparar la revisión.');return data;
  }
  async function launch(payload){
    if(working)return;working=true;
    try{
      if(payload.mode==='sync'&&typeof showLoading==='function')showLoading('Buscando eventos nuevos y cambios del mes…');
      const review=await api({...payload,action:'preview'});
      const imports=payload.mode==='sync'?await window.previewCalendarImport(payload.month):null;
      closeModal('modal-evento');
      showReview(review,payload,imports);
    }catch(error){showErrorModal('Revisión pendiente',error.message,'warning');}
    finally{working=false;if(typeof hideLoading==='function')hideLoading();}
  }
  function showReview(review,payload,imports){
    document.getElementById('protected-review-dialog')?.remove();
    const overlay=node('div');overlay.id='protected-review-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','protected-review-title');overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
    const body=node('div');body.style.cssText='background:white;color:#0f172a;border-radius:12px;padding:24px;width:100%;max-width:850px;max-height:90vh;overflow:auto';overlay.append(body);
    const title=node('h2','Revisar antes de guardar');title.id='protected-review-title';title.style.cssText='font-size:22px;font-weight:bold';body.append(title);
    body.append(node('p','Los precios, importes, barrios y direcciones se conservan salvo que aceptes una propuesta. Precio e importe son por sesión: la duración no los multiplica. Los eventos eliminados se retiran a una papelera recuperable. Solo se guarda en la hoja seleccionada; Calendar no cambia.'));
    const status=node('p');status.setAttribute('role','status');body.append(status);
    const newCount=imports?.summary?.length||0,movedCount=imports?.moves?.length||0,removedCount=imports?.removals?.length||0;
    const reconciled=new Set([...(imports?.moves||[]),...(imports?.removals||[])].map(s=>s.rowIdx));
    const activePlans=review.plans.filter(p=>!reconciled.has(p.rowIdx));
    if(imports){
      body.append(node('h2',`Eventos nuevos de Calendar (${newCount})`));
      body.append(node('p',newCount?'Estas sesiones amarillas aún no están en la hoja. Revisa su incorporación antes de guardarlas.':'No se han encontrado sesiones nuevas incorporables en este mes.'));
      if(newCount){
        const details=node('details');details.append(node('summary',`Ver ${newCount} ${newCount===1?'sesión nueva':'sesiones nuevas'}`));
        for(const s of imports.summary)details.append(node('p',`${groupLabel(s.group,s.date)} · ${s.date.split('-').reverse().join('/')} · ${s.start}–${s.end} · ${currency(s.total)}`));body.append(details);
      }
      if(movedCount){body.append(node('h2',`Cambios de fecha u horario (${movedCount})`));for(const s of imports.moves)body.append(node('p',`${groupLabel(s.group,s.date)} · ${s.previous.date.split('-').reverse().join('/')} ${s.previous.start}–${s.previous.end} → ${s.date.split('-').reverse().join('/')} ${s.start}–${s.end}. Se actualiza la misma fila.`));}
      if(removedCount){body.append(node('h2',`Sesiones eliminadas de Calendar (${removedCount})`));for(const s of imports.removals)body.append(node('p',`${groupLabel(s.group,s.date)} · ${s.date.split('-').reverse().join('/')} · ${s.start}–${s.end}`));body.append(node('p','Se retirarán de la hoja y sus totales, con una copia recuperable en «Sesiones archivadas».'));}
      if(newCount||movedCount||removedCount){
        const add=node('button',movedCount||removedCount?'Revisar sincronización de Calendar':`Revisar incorporación de ${newCount} ${newCount===1?'sesión':'sesiones'}`);add.type='button';add.className='review-primary';
        add.onclick=async()=>{if(saving)return;close();try{await window.reviewCalendarImport(payload.month);}catch(error){showErrorModal('No se pudieron revisar los eventos',error.message,'warning');}};body.append(add);
      }
      const skipped=imports.skipped.filter(s=>!['CalendarId ya registrado','Sesión con el mismo grupo, fecha y horario; se conserva la existente'].includes(s.reason));
      if(skipped.length){const details=node('details');details.append(node('summary',`${skipped.length} eventos se conservan o requieren revisión`));for(const s of skipped)details.append(node('p',`${s.title} · ${s.date.split('-').reverse().join('/')}: ${s.reason}`));body.append(details);}
      body.append(node('h2','Cambios en sesiones existentes'));
    }
    const decisions=[];let differences=0;
    for(const plan of activePlans){
      if(!Object.values(plan.diff).some(Boolean)&&!plan.notes.length&&payload.mode==='sync')continue;
      const details=node('details');details.open=review.plans.length===1;details.style.cssText='border-top:1px solid #cbd5e1;padding:12px 0';
      details.append(node('summary',`Fila ${plan.rowIdx} · ${plan.group} · ${plan.date}`));body.append(details);
      details.append(node('p',`Origen: ${plan.source}`));
      const decision={rowIdx:plan.rowIdx,expectedVersion:plan.expectedVersion,proposalVersion:plan.proposalVersion,choices:{money:'keep',district:'keep',address:'keep',time:'keep'}};decisions.push(decision);
      const fields=[['money','Precio e importe por sesión',`${currency(plan.current.price)} / ${currency(plan.current.total)}`,plan.proposal.money?`${currency(plan.proposal.money.price)} / ${currency(plan.proposal.money.total)}`:'Sin propuesta'],['district','Barrio',plan.current.district||'(vacío)',plan.proposal.district||'(sin propuesta; se conserva)'],['address','Dirección de esta sesión',plan.current.address||'(vacía)',plan.proposal.address||'(sin propuesta; se conserva)'],['time','Horario de la sesión',`${plan.current.start||'?'}–${plan.current.end||'?'}`,plan.proposal.time?`${plan.proposal.time.start}–${plan.proposal.time.end}`:'Sin propuesta']];
      for(const [field,label,current,next]of fields){
        details.append(node('p',`${label}: actual ${current}${plan.diff[field]?` → propuesta ${next}`:' · se conserva'}`));
        if(!plan.diff[field])continue;differences++;
        const wrapper=node('label',`${label}, fila ${plan.rowIdx}: `),select=node('select');select.setAttribute('aria-label',`${label}, fila ${plan.rowIdx}`);select.style.cssText='border:1px solid #94a3b8;padding:8px;max-width:100%;margin:6px 0';
        for(const [value,text]of [['keep','Conservar actual'],['use','Usar propuesta']]){const option=node('option',text);option.value=value;select.append(option);}
        select.onchange=()=>{decision.choices[field]=select.value;};wrapper.append(select);details.append(wrapper);
      }
      for(const note of plan.notes)details.append(node('p',note));
    }
    const warnings=activePlans.filter(p=>p.notes.length).length;
    status.textContent=(imports?`${newCount} ${newCount===1?'sesión nueva':'sesiones nuevas'} de Calendar. ${movedCount} ${movedCount===1?'cambio':'cambios'} de fecha u horario. ${removedCount} ${removedCount===1?'sesión':'sesiones'} para retirar. `:'')+(differences?`${differences} ${differences===1?'diferencia':'diferencias'} en datos manuales para revisar. Nada se ha escrito.`:'Sin otros cambios en los datos manuales.')+(warnings?` Hay avisos en ${warnings} sesión(es).`:'');
    const save=node('button',imports?'Guardar cambios en sesiones existentes':'Confirmar decisiones en la hoja seleccionada'),cancel=node('button','Cancelar sin guardar');save.className='review-primary';save.type=cancel.type='button';save.style.cssText='padding:10px;margin:12px 12px 0 0;border:1px solid #475569;border-radius:6px;font-weight:bold';cancel.style.cssText='padding:10px;border:1px solid #94a3b8;border-radius:6px';body.append(save,cancel);
    let saving=false;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    if(window.horasWritesEnabled===false||!differences){save.disabled=true;save.title= !differences?'No hay cambios en sesiones existentes.':'Solo lectura: cambios pendientes de activación.';}
    const close=()=>{overlay.remove();document.body.style.overflow=previousOverflow;};
    cancel.onclick=()=>{if(!saving){close();document.getElementById('test-result').textContent='Revisión cancelada. No se ha guardado nada.';}};
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'&&!saving)cancel.click();});
    save.onclick=async()=>{
      if(saving)return;saving=true;save.disabled=cancel.disabled=true;for(const select of body.querySelectorAll('select'))select.disabled=true;
      status.textContent='Comprobando de nuevo los datos antes de guardar…';
      try{
        const result=await api({...payload,action:'apply',catalogVersion:review.catalogVersion,decisions});
        close();document.getElementById('test-result').textContent=result.unchanged?'Se ha conservado todo. Ninguna celda modificada.':`Guardado y verificado: ${result.rowsChanged} sesión(es), ${result.cellsChanged} celda(s). Calendar sin cambios.`;
        if(!result.unchanged){try{await syncData(false,false);}catch(error){document.getElementById('test-result').textContent=`Guardado y verificado: ${result.rowsChanged} sesión(es), ${result.cellsChanged} celda(s). Falta recargar la vista: ${error.message}`;}}
      }catch(error){status.textContent=error.message;status.scrollIntoView({block:'nearest'});}
      finally{saving=false;save.disabled=window.horasWritesEnabled===false||!differences;cancel.disabled=false;for(const select of body.querySelectorAll('select'))select.disabled=false;}
    };
    document.body.append(overlay);title.tabIndex=-1;title.focus({preventScroll:true});body.scrollTop=0;
  }
  window.configureProtectedSession=function(ev){
    if(!(CONFIG.PROTECTED_MODE || CONFIG.TEST_MODE)||CONFIG.TEST_PHASE<3)return;
    const fields=document.getElementById('protected-session-fields');fields.hidden=false;
    document.getElementById('ev-total').value=String(ev.total).replace('.',',');document.getElementById('ev-barrio').value=ev.sitio||'';
    for(const id of ['ev-fecha','ev-grupo','ev-grupo-search','ev-bolo','ev-sitio','ev-repite','ev-freq','ev-interval','ev-until'])document.getElementById(id).disabled=true;
    document.getElementById('ev-sitio').value=ev.direccion||'';
    if(CONFIG.TEST_PHASE>=7)document.getElementById('ev-sitio').disabled=false;
    for(const id of ['ev-hora-inicio','ev-hora-fin'])document.getElementById(id).required=false;
    document.getElementById('ev-hora-inicio').value=CalendarLinking.time(ev.horaInicio);document.getElementById('ev-hora-fin').value=CalendarLinking.time(ev.horaFin);
  };
  window.reviewSessionForm=async function(){
    const rowIdx=Number(document.getElementById('ev-rowIdx').value);if(!rowIdx){showErrorModal('Sesión pendiente','Abre de nuevo el formulario para revisar una sesión existente.','info');return;}
    const proposal={price:document.getElementById('ev-precio').value,total:document.getElementById('ev-total').value,district:document.getElementById('ev-barrio').value};
    if(CONFIG.TEST_PHASE>=7)proposal.address=document.getElementById('ev-sitio').value;
    const start=document.getElementById('ev-hora-inicio').value,end=document.getElementById('ev-hora-fin').value;if(start||end){proposal.start=start;proposal.end=end;}
    await launch({mode:'edit',rowIdx,proposal});
  };
  window.prepareProtectedSync=async function(){
    if(!monthInput){showErrorModal('Preparando sincronización','Espera a que se compruebe la conexión.','info');return;}
    if(CONFIG.DATA_MODE!=='production'){await launch({mode:'sync',month:monthInput.value});return;}
    if(document.getElementById('sync-month-dialog'))return;
    const dialog=node('dialog');dialog.id='sync-month-dialog';dialog.setAttribute('aria-label','Sincronizar sesiones');dialog.style.cssText='padding:24px;border-radius:16px;width:min(420px,95vw)';
    dialog.append(node('h2','Sincronizar sesiones'),node('p','Revisaremos altas, cambios de fecha u horario y eventos eliminados del mes seleccionado. Las bajas se retiran a una papelera recuperable. Los eventos trasladados a otro mes actualizan su misma fila; las filas manuales y referencias históricas se conservan.'));const label=node('label','Mes: '),input=node('input');input.type='month';input.required=true;input.value=monthInput.value;label.append(input);dialog.append(label);
    const review=node('button','Revisar cambios'),cancel=node('button','Cancelar');review.className='review-primary';for(const b of [review,cancel]){b.type='button';b.style.cssText='padding:10px;margin:12px 8px 0 0;border:1px solid #94a3b8;border-radius:8px';}dialog.append(review,cancel);
    const close=()=>{dialog.close();dialog.remove();};cancel.onclick=close;dialog.addEventListener('cancel',()=>dialog.remove());
    review.onclick=async()=>{if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.value)){input.reportValidity();return;}monthInput.value=input.value;close();await launch({mode:'sync',month:monthInput.value});};
    document.body.append(dialog);dialog.showModal();input.focus();
  };
  window.mountProtectedReview=function(banner,audit=banner){
    if(document.getElementById('protected-sync-month'))return;
    const wrapper=node('div');wrapper.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid #b8ac7a';banner.append(wrapper);
    const label=node('label','Mes para revisar precios, barrios, direcciones y horarios: ');monthInput=node('input');monthInput.type='month';monthInput.id='protected-sync-month';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).formatToParts(new Date());monthInput.value=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;label.append(monthInput);wrapper.append(label);
    const button=node('button','Preparar revisión de sincronización');button.type='button';button.style.cssText='margin:8px;padding:8px;border:1px solid currentColor;border-radius:6px';button.onclick=window.prepareProtectedSync;wrapper.append(button);
    const rowTools=node('div');audit.append(rowTools);
    const rowLabel=node('label',' Editar sesión, fila: '),row=node('input');row.type='number';row.min='2';row.style.cssText='width:90px;border:1px solid #94a3b8;padding:4px';rowLabel.append(row);rowTools.append(rowLabel);
    const edit=node('button','Abrir sesión');edit.type='button';edit.onclick=()=>{if(!eventos.some(e=>e.rowIdx===Number(row.value))){showErrorModal('Sesión no disponible','Actualiza los datos y elige una fila existente.','info');return;}openEditSesionModal(Number(row.value));};rowTools.append(edit);
  };
})();
