(() => {
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  let busy=false;
  async function api(payload){
    if(!await window.horasEnvironmentReady)throw new Error('El entorno de pruebas no está comprobado.');
    const token=gapi.client?.getToken()?.access_token||localStorage.getItem('g_token_pruebas');if(!token)throw new Error('Primero conecta Google.');
    const response=await fetch(CONFIG.GROUPS_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,...payload})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo revisar el grupo.');return data;
  }
  async function review(rowIdx,proposal){
    if(busy)return;busy=true;let p;try{p=await api({action:'preview',rowIdx,proposal});}finally{busy=false;}
    document.getElementById('group-review-dialog')?.remove();
    const dialog=node('dialog');dialog.id='group-review-dialog';dialog.setAttribute('aria-label','Revisar tarifas y ubicación del grupo');dialog.style.cssText='padding:24px;border-radius:16px;width:min(650px,95vw);max-height:90vh;overflow:auto;color:#0f172a';
    dialog.append(node('h2',`Revisar grupo: ${p.name}`),node('p','A Grupo · B Dirección · C Precio de sesión · D Precio Bolo · E Barrio/Ubicación. Solo se guardan los campos que elijas. Las sesiones ya registradas conservan sus importes y barrios.'));
    const choices={price:'keep',gigPrice:'keep',location:'keep'};
    for(const [key,label]of [['price','Precio de sesión'],['gigPrice','Precio Bolo'],['location','Barrio/Ubicación'],['address','Dirección habitual']]){
      const display=v=>typeof v==='number'?LocaleData.currency(v):String(v||'(vacío)');
      dialog.append(node('p',`${label}: actual ${display(p.current[key])}${p.diff[key]?` → propuesta ${display(p.proposal[key])}`:' · se conserva'}`));
      if(!p.diff[key])continue;
      const wrapper=node('label',`${label}: `),select=node('select');select.setAttribute('aria-label',`Decisión: ${label}`);select.style.cssText='padding:8px;border:1px solid #64748b;margin:8px';
      for(const [value,text]of [['keep','Conservar actual'],['use','Usar propuesta']]){const option=node('option',text);option.value=value;select.append(option);}select.onchange=()=>choices[key]=select.value;wrapper.append(select);dialog.append(wrapper);
    }
    const status=node('p');status.setAttribute('role','status');dialog.append(status);
    const save=node('button','Confirmar cambios del grupo en la copia'),cancel=node('button','Cancelar sin guardar');save.type=cancel.type='button';for(const b of [save,cancel])b.style.cssText='margin:8px;padding:10px;border:1px solid #64748b;border-radius:6px';dialog.append(save,cancel);
    cancel.onclick=()=>{if(!busy){dialog.close();dialog.remove();}};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    save.onclick=async()=>{if(busy)return;busy=true;save.disabled=cancel.disabled=true;for(const select of dialog.querySelectorAll('select'))select.disabled=true;status.textContent='Volviendo a leer el grupo antes de guardar…';
      try{const r=await api({action:'apply',rowIdx,proposal,expectedVersion:p.expectedVersion,choices});status.textContent=r.unchanged?'Se conserva todo. Ninguna celda modificada.':`${r.cellsChanged} celdas guardadas y verificadas. Calendar y sesiones sin cambios.`;if(!r.unchanged){await syncData(false,false);closeModal('modal-grupo');}save.hidden=true;cancel.textContent='Cerrar';}
      catch(error){status.textContent=error.message;save.hidden=true;}finally{busy=false;cancel.disabled=false;}
    };
    document.body.append(dialog);dialog.showModal();cancel.focus();
  }
  window.reviewGroupForm=async()=>{
    const rowIdx=Number(document.getElementById('gr-rowIdx').value);if(!rowIdx)throw new Error('En esta fase se revisan grupos existentes. Las altas siguen bloqueadas.');
    const proposal={location:document.getElementById('gr-ubicacion').value};for(const [key,id]of [['price','gr-precio'],['gigPrice','gr-precio-bolo']]){const value=document.getElementById(id).value;if(value.trim()!=='')proposal[key]=value;}
    if(CONFIG.TEST_PHASE>=7)proposal.address=document.getElementById('gr-sitio').value;
    await review(rowIdx,proposal);
  };
  window.mountGroupReview=banner=>{
    const wrapper=node('section');wrapper.id='group-review';wrapper.style.cssText='margin-top:12px;border-top:1px solid #b8ac7a;padding-top:12px';banner.append(wrapper);
    const button=node('button','Revisar Precio Bolo y Ubicación');button.type='button';button.style.cssText='padding:8px;border:1px solid currentColor;border-radius:6px';wrapper.append(button);const status=node('p');status.setAttribute('role','status');const list=node('div');wrapper.append(status,list);
    button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;status.textContent='Leyendo el catálogo; no se escribe nada…';list.replaceChildren();try{const audit=await api({action:'audit'});const issues=audit.groups.filter(g=>g.notes.length);status.textContent=`${audit.groups.length} grupos revisados; ${issues.length} con avisos. Ningún intercambio automático.`;for(const g of issues){const row=node('div');row.style.cssText='padding:8px;border-bottom:1px solid #cbd5e1';row.append(node('p',`Fila ${g.rowIdx} · ${g.name}: D=${g.current.gigPrice} · E=${g.current.location}`),node('p',g.notes.join(' ')));if(g.suspected){const repair=node('button','Revisar posible intercambio D/E');repair.type='button';repair.onclick=()=>review(g.rowIdx,{gigPrice:g.current.location,location:String(g.current.gigPrice)}).catch(e=>status.textContent=e.message);row.append(repair);}list.append(row);}}
      catch(error){status.textContent=error.message;}finally{busy=false;button.disabled=false;}};
  };
})();
