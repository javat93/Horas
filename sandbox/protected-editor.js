(function(){
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const currency=value=>value===null?'Sin importe numérico':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
  let working=false,monthInput;
  async function api(payload){
    if(!await window.horasEnvironmentReady)throw new Error('El entorno de pruebas no está verificado.');
    const token=window.horasAccessToken ? window.horasAccessToken() : gapi.client?.getToken()?.access_token||localStorage.getItem('g_token_pruebas');if(!token)throw new Error('Primero conecta Google.');
    const response=await (window.horasFetch||fetch)(CONFIG.PROTECTED_REVIEW_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,...payload})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo preparar la revisión.');return data;
  }
  async function launch(payload){
    if(working)return;working=true;
    try{
      const review=await api({...payload,action:'preview'});
      closeModal('modal-evento');
      showReview(review,payload);
    }catch(error){showErrorModal('Revisión pendiente',error.message,'warning');}
    finally{working=false;}
  }
  function showReview(review,payload){
    document.getElementById('protected-review-dialog')?.remove();
    const overlay=node('div');overlay.id='protected-review-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','protected-review-title');overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
    const body=node('div');body.style.cssText='background:white;color:#0f172a;border-radius:12px;padding:24px;width:100%;max-width:850px;max-height:90vh;overflow:auto';overlay.append(body);
    const title=node('h2','Revisar antes de guardar');title.id='protected-review-title';title.style.cssText='font-size:22px;font-weight:bold';body.append(title);
    body.append(node('p','Por defecto se conserva todo. Precio e importe son por sesión: la duración no los multiplica. Conservar mantiene tus fórmulas; aceptar la propuesta económica fija el importe elegido. Solo se guarda en la copia; Calendar no cambia.'));
    const status=node('p');status.setAttribute('role','status');body.append(status);
    const decisions=[];let differences=0;
    for(const plan of review.plans){
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
    const warnings=review.plans.filter(p=>p.notes.length).length;
    status.textContent=(differences?`${differences} diferencias para revisar. Nada se ha escrito.`:'No hay diferencias que guardar.')+(warnings?` Hay avisos en ${warnings} sesión(es).`:'');
    const save=node('button','Confirmar decisiones en la copia'),cancel=node('button','Cancelar sin guardar');save.type=cancel.type='button';save.style.cssText='padding:10px;margin:12px 12px 0 0;border:1px solid #475569;border-radius:6px;font-weight:bold';cancel.style.cssText='padding:10px;border:1px solid #94a3b8;border-radius:6px';body.append(save,cancel);
    let saving=false;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const close=()=>{overlay.remove();document.body.style.overflow=previousOverflow;};
    cancel.onclick=()=>{if(!saving){close();document.getElementById('test-result').textContent='Revisión cancelada. No se ha guardado nada.';}};
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'&&!saving)cancel.click();});
    save.onclick=async()=>{
      if(saving)return;saving=true;save.disabled=cancel.disabled=true;for(const select of body.querySelectorAll('select'))select.disabled=true;
      status.textContent='Comprobando de nuevo los datos antes de guardar…';
      try{
        const result=await api({...payload,action:'apply',catalogVersion:review.catalogVersion,decisions});
        close();document.getElementById('test-result').textContent=result.unchanged?'Se ha conservado todo. Ninguna celda modificada.':`Guardado y verificado: ${result.rowsChanged} sesión(es), ${result.cellsChanged} celda(s). Calendar sin cambios.`;
        if(!result.unchanged)await syncData(false,false);
      }catch(error){status.textContent=error.message;status.scrollIntoView({block:'nearest'});}
      finally{saving=false;save.disabled=cancel.disabled=false;for(const select of body.querySelectorAll('select'))select.disabled=false;}
    };
    document.body.append(overlay);cancel.focus();
  }
  window.configureProtectedSession=function(ev){
    if(!CONFIG.TEST_MODE||CONFIG.TEST_PHASE<3)return;
    const fields=document.getElementById('protected-session-fields');fields.hidden=false;
    document.getElementById('ev-total').value=String(ev.total).replace('.',',');document.getElementById('ev-barrio').value=ev.sitio||'';
    for(const id of ['ev-fecha','ev-grupo','ev-grupo-search','ev-bolo','ev-sitio','ev-repite','ev-freq','ev-interval','ev-until'])document.getElementById(id).disabled=true;
    document.getElementById('ev-sitio').value=ev.direccion||'';
    if(CONFIG.TEST_PHASE>=7)document.getElementById('ev-sitio').disabled=false;
    for(const id of ['ev-hora-inicio','ev-hora-fin'])document.getElementById(id).required=false;
    document.getElementById('ev-hora-inicio').value=CalendarLinking.time(ev.horaInicio);document.getElementById('ev-hora-fin').value=CalendarLinking.time(ev.horaFin);
  };
  window.reviewSessionForm=async function(){
    const rowIdx=Number(document.getElementById('ev-rowIdx').value);if(!rowIdx){showErrorModal('Fase 3','Las altas se probarán después de corregir fechas. Ahora puedes revisar sesiones existentes.','info');return;}
    const proposal={price:document.getElementById('ev-precio').value,total:document.getElementById('ev-total').value,district:document.getElementById('ev-barrio').value};
    if(CONFIG.TEST_PHASE>=7)proposal.address=document.getElementById('ev-sitio').value;
    const start=document.getElementById('ev-hora-inicio').value,end=document.getElementById('ev-hora-fin').value;if(start||end){proposal.start=start;proposal.end=end;}
    await launch({mode:'edit',rowIdx,proposal});
  };
  window.prepareProtectedSync=async function(){if(!monthInput){showErrorModal('Preparando revisión','Espera a que se compruebe el entorno de pruebas.','info');return;}await launch({mode:'sync',month:monthInput.value});};
  window.mountProtectedReview=function(banner){
    if(document.getElementById('protected-sync-month'))return;
    const wrapper=node('div');wrapper.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid #b8ac7a';banner.append(wrapper);
    const label=node('label','Mes para revisar precios, barrios, direcciones y horarios: ');monthInput=node('input');monthInput.type='month';monthInput.id='protected-sync-month';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).formatToParts(new Date());monthInput.value=parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;label.append(monthInput);wrapper.append(label);
    const button=node('button','Preparar revisión de sincronización');button.type='button';button.style.cssText='margin:8px;padding:8px;border:1px solid currentColor;border-radius:6px';button.onclick=window.prepareProtectedSync;wrapper.append(button);
    const rowLabel=node('label',' Editar sesión, fila: '),row=node('input');row.type='number';row.min='2';row.style.cssText='width:90px;border:1px solid #94a3b8;padding:4px';rowLabel.append(row);wrapper.append(rowLabel);
    const edit=node('button','Abrir sesión');edit.type='button';edit.onclick=()=>{if(!eventos.some(e=>e.rowIdx===Number(row.value))){showErrorModal('Sesión no disponible','Recarga la copia y elige una fila existente.','info');return;}openEditSesionModal(Number(row.value));};wrapper.append(edit);
  };
})();
