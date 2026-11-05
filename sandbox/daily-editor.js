(()=>{
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  let busy=false;
  const value=id=>document.getElementById(id).value;
  async function api(body){
    if(!await window.horasEnvironmentReady||!window.horasDailyReady)throw Error('El backend aún no ha confirmado las operaciones diarias. Recarga antes de continuar.');
    const token=window.horasAccessToken();if(!token)throw Error('Primero conecta Google.');
    const r=await (window.horasFetch||fetch)(CONFIG.DAILY_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,...body})});
    const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo completar la operación.');return data;
  }
  async function review(kind,input){
    if(busy)return;busy=true;let plan;try{plan=await api({action:'preview',kind,input});}finally{busy=false;}
    const d=node('dialog');d.setAttribute('aria-label','Revisar operación antes de guardar');d.style.cssText='padding:24px;border-radius:16px;width:min(760px,95vw);max-height:90vh;overflow:auto';
    const title={group:'Nuevo grupo',session:'Nuevas sesiones',import:'Importar desde Calendar',sync:'Sincronizar con Calendar',delete:'Enviar sesión a la papelera',restore:'Restaurar sesión'}[kind];
    const heading=node('h2',title);d.append(heading,node('p','Destino: '+(CONFIG.SPREADSHEET_NAME||'hoja seleccionada')+'. Calendar se consulta, sin crear, editar ni eliminar eventos. Las sesiones ya existentes conservan sus precios, barrios y direcciones.'));
    if(kind==='sync')d.append(node('h3',`Nuevas sesiones (${plan.summary.length})`));
    for(const s of plan.summary){
      const card=node('div');card.className='review-record';d.append(card);
      const label=kind==='group'?`${GroupIdentity.catalogLabel(s.name)} · sesión: ${s.price===''?'sin tarifa':LocaleData.currency(s.price)} · bolo: ${s.gigPrice===''?'sin tarifa':LocaleData.currency(s.gigPrice)}`:`${GroupIdentity.label(s.group,s.date)} · ${LocaleData.display(s.date)} · ${s.start||''}–${s.end||''} · ${LocaleData.numeric(s.total)===null?'sin importe':LocaleData.currency(LocaleData.numeric(s.total))}`;
      card.append(node('p',label));if(s.district||s.address)card.append(node('p',`Barrio: ${s.district||'(vacío)'} · Dirección: ${s.address||'(vacía)'}`));
    }
    if(kind==='sync'){
      d.append(node('h3',`Cambios de fecha u horario (${plan.moves.length})`));
      for(const s of plan.moves){const card=node('div');card.className='review-record';card.append(node('p',`${GroupIdentity.label(s.group,s.date)} · ${LocaleData.display(s.previous.date)} ${s.previous.start}–${s.previous.end} → ${LocaleData.display(s.date)} ${s.start}–${s.end}`),node('p','Se actualiza la misma fila, conservando el importe y los datos manuales.'));d.append(card);}
      d.append(node('h3',`Sesiones que se retirarán (${plan.removals.length})`));
      for(const s of plan.removals){const card=node('div');card.className='review-record';card.append(node('p',`${GroupIdentity.label(s.group,s.date)} · ${LocaleData.display(s.date)} · ${s.start}–${s.end}`),node('p',s.reason));d.append(card);}
      if(plan.removals.length)d.append(node('p','Las sesiones retiradas desaparecen de la lista y los totales, y se pueden recuperar desde «Sesiones archivadas». Las filas manuales y las referencias históricas protegidas se conservan.'));
    }
    if(kind==='delete')d.append(node('p','Se conserva una copia recuperable y se vacía únicamente esta fila, sin desplazar otras filas ni borrar el evento de Calendar.'));
    for(const s of plan.skipped.filter(s=>kind!=='sync'||!['CalendarId ya registrado','Sesión con el mismo grupo, fecha y horario; se conserva la existente'].includes(s.reason)))d.append(node('p',`Sin sincronizar ${s.title||''} · ${LocaleData.display(s.date)||''}: ${s.reason}`));
    const extra=node('input');extra.type='checkbox';if(plan.duplicates){const label=node('label',`${plan.duplicates} sesiones coinciden con un registro existente. Crear una partida adicional de cobro: `);label.append(extra);d.append(label);}
    const status=node('p');status.setAttribute('role','status');d.append(status);
    const save=node('button',kind==='sync'?'Confirmar sincronización':'Confirmar en la hoja seleccionada'),cancel=node('button','Cancelar sin guardar');save.className='review-primary';save.type=cancel.type='button';for(const b of [save,cancel])b.style.cssText='padding:10px;margin:8px;border:1px solid #64748b;border-radius:6px';d.append(save,cancel);if(window.horasWritesEnabled===false){save.disabled=true;status.textContent='Solo lectura: los cambios aún no están activados.';}
    const operationId=crypto.randomUUID();let saving=false,uncertain=false;
    cancel.onclick=()=>{if(!saving){d.close();d.remove();}};d.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    save.onclick=async()=>{
      if(saving||busy)return;if(plan.duplicates&&!extra.checked){status.textContent='Confirma la partida adicional o cancela.';return;}
      saving=busy=true;save.disabled=cancel.disabled=extra.disabled=true;status.textContent='Releyendo y comprobando antes de guardar…';
      try{
        const result=await api({action:'apply',kind,input,expectedVersion:plan.version,operationId,allowSimilar:extra.checked});
        save.hidden=true;cancel.textContent='Cerrar';const message=result.alreadyApplied?'Esta operación ya se registró; no se ha repetido.':result.unchanged?'No hay cambios que guardar.':kind==='sync'?`Sincronización verificada. Altas: ${result.added}. Cambios de fecha u horario: ${result.moved}. Sesiones retiradas: ${result.removed}. Calendar sin cambios.`:`Operación guardada y verificada: ${result.saved} registro(s). Calendar sin cambios.`;
        status.textContent=message;document.getElementById('test-result').textContent=message;
        if(kind==='session')closeModal('modal-evento');if(kind==='group')closeModal('modal-grupo');if(kind==='import')closeModal('modal-future-events');
        try{await syncData(false,false);}catch(e){status.textContent=message+' Falta recargar la vista: '+e.message;}
      }catch(e){uncertain=true;status.textContent=e.message+' No abras otra revisión si el resultado es incierto. Puedes comprobar la misma operación con este botón.';save.textContent='Comprobar la misma operación';}
      finally{saving=busy=false;save.disabled=window.horasWritesEnabled===false;cancel.disabled=false;extra.disabled=uncertain;}
    };
    document.body.append(d);d.showModal();heading.tabIndex=-1;heading.focus({preventScroll:true});d.scrollTop=0;
  }
  window.reviewNewSessionForm=()=>{
    const input={group:value('ev-grupo'),date:value('ev-fecha'),start:value('ev-hora-inicio'),end:value('ev-hora-fin'),price:value('ev-precio'),district:value('ev-barrio'),address:value('ev-sitio'),gig:document.getElementById('ev-bolo').checked};
    if(value('ev-total').trim()!=='')input.total=value('ev-total');
    if(document.getElementById('ev-repite').checked)input.repeat={frequency:value('ev-freq'),interval:Number(value('ev-interval')),until:value('ev-until')};
    return review('session',input);
  };
  window.reviewNewGroupForm=()=>review('group',{name:value('gr-nombre'),price:value('gr-precio'),gigPrice:value('gr-precio-bolo'),address:value('gr-sitio'),district:value('gr-ubicacion')});
  window.reviewFutureImport=()=>review('import',{month:value('future-year')+'-'+value('future-month').padStart(2,'0')});
  window.previewCalendarImport=month=>api({action:'preview',kind:'sync',input:{month}});
  window.reviewCalendarImport=month=>review('sync',{month});
  window.reviewDeleteSession=rowIdx=>review('delete',{rowIdx});
  window.mountDailyOperations=banner=>{
    const production=CONFIG.DATA_MODE==='production',b=node('button',production?'Papelera':'Abrir papelera de sesiones');b.type='button';if(production)b.className='bg-white text-slate-700 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all text-sm';else b.style.cssText='padding:8px;margin-top:12px;border:1px solid currentColor;border-radius:6px';banner.append(b);
    if(production){
      b.className='archive-link';b.textContent='Sesiones archivadas';b.id='session-archive-button';
      document.getElementById('session-archive-actions').append(b);
    }
    b.onclick=async()=>{if(busy)return;busy=true;try{
      const result=await api({action:'trash'}),d=node('dialog');d.setAttribute('aria-label','Papelera de sesiones');d.style.cssText='padding:24px;max-height:90vh;overflow:auto';d.append(node('h2','Sesiones archivadas'));
      if(!result.items.length)d.append(node('p','La papelera está vacía.'));
      for(const r of result.items){d.append(node('p',`${GroupIdentity.label(r.group,r.date)} · ${LocaleData.display(r.date)} · fila ${r.rowIdx}`));const restore=node('button','Revisar restauración');restore.type='button';restore.onclick=()=>{d.close();d.remove();review('restore',{operationId:r.operationId}).catch(e=>showErrorModal('Papelera',e.message,'warning'));};d.append(restore);}
      const close=node('button','Cerrar');close.type='button';close.onclick=()=>{d.close();d.remove();};d.append(close);document.body.append(d);d.showModal();
    }catch(e){showErrorModal('Papelera',e.message,'warning');}finally{busy=false;}};
  };
})();
