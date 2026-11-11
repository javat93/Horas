(() => {
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  let busy=false;
  async function api(payload){
    if(!await window.horasEnvironmentReady)throw new Error('El entorno protegido no está comprobado.');
    const token=window.horasAccessToken?.();if(!token)throw new Error('Primero conecta Google.');
    const response=await (window.horasFetch||fetch)(CONFIG.GROUPS_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,...payload})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo revisar el grupo.');return data;
  }
  async function review(rowIdx,proposal){
    if(busy)return;busy=true;let p;try{p=await api({action:'preview',rowIdx,proposal});}finally{busy=false;}
    document.getElementById('group-review-dialog')?.remove();
    const dialog=node('dialog');dialog.id='group-review-dialog';dialog.setAttribute('aria-label','Revisar tarifas y ubicación del grupo');dialog.style.cssText='padding:24px;border-radius:16px;width:min(650px,95vw);max-height:90vh;overflow:auto;color:#0f172a';
    dialog.append(node('h2',`Revisar grupo: ${p.name}`),node('p','Solo se muestran los datos que cambiarían. Elige cuáles quieres guardar; las sesiones ya registradas conservan sus importes y barrios.'));
    const choices={price:'keep',gigPrice:'keep',location:'keep',address:'keep'};
    let differences=0;
    for(const [key,label]of [['price','Precio de sesión'],['gigPrice','Precio Bolo'],['location','Barrio/Ubicación'],['address','Dirección habitual']]){
      if(!p.diff[key])continue;differences++;
      const display=v=>typeof v==='number'?LocaleData.currency(v):String(v||'(vacío)');
      dialog.append(node('p',`${label}: actual ${display(p.current[key])} → propuesta ${display(p.proposal[key])}`));
      const wrapper=node('label',`${label}: `),select=node('select');select.setAttribute('aria-label',`Decisión: ${label}`);select.style.cssText='padding:8px;border:1px solid #64748b;margin:8px';
      for(const [value,text]of [['keep','Conservar actual'],['use','Usar propuesta']]){const option=node('option',text);option.value=value;select.append(option);}select.onchange=()=>choices[key]=select.value;wrapper.append(select);dialog.append(wrapper);
    }
    const status=node('p');status.setAttribute('role','status');dialog.append(status);
    const save=node('button','Confirmar cambios del grupo en la hoja seleccionada'),cancel=node('button','Cancelar sin guardar');save.className='review-primary';save.type=cancel.type='button';for(const b of [save,cancel])b.style.cssText='margin:8px;padding:10px;border:1px solid #64748b;border-radius:6px';dialog.append(save,cancel);
    if(!differences){status.textContent='No hay cambios en los datos del grupo.';save.disabled=true;}
    cancel.onclick=()=>{if(!busy){dialog.close();dialog.remove();}};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    save.onclick=async()=>{
      if(busy||!differences)return;busy=true;
      const request=api({action:'apply',rowIdx,proposal,expectedVersion:p.expectedVersion,choices});
      dialog.close();dialog.remove();closeModal('modal-grupo');
      const resultHost=document.getElementById('test-result');resultHost.textContent='Guardando los cambios del grupo…';
      try{
        const r=await request;const saved=r.unchanged?'Se conserva todo. Ninguna celda modificada.':`${r.cellsChanged} celdas guardadas y verificadas. Calendar y sesiones sin cambios.`;resultHost.textContent=saved;
        if(!r.unchanged){try{await syncData(false,false);}catch(error){resultHost.textContent=saved+' Falta recargar la vista: '+error.message;}}
      }catch(error){resultHost.textContent='No se pudieron guardar los cambios del grupo.';showErrorModal('No se pudo guardar el grupo',error.message,'warning');}
      finally{busy=false;}
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
    button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;status.textContent='Leyendo el catálogo; no se escribe nada.';list.replaceChildren();try{const audit=await api({action:'audit'});const issues=audit.groups.filter(g=>g.notes.length);status.textContent=`${audit.groups.length} grupos revisados; ${issues.length} con avisos. Ningún intercambio automático.`;for(const g of issues){const row=node('div');row.style.cssText='padding:8px;border-bottom:1px solid #cbd5e1';row.append(node('p',`Fila ${g.rowIdx} · ${g.name}: D=${g.current.gigPrice} · E=${g.current.location}`),node('p',g.notes.join(' ')));if(g.suspected){const repair=node('button','Revisar posible intercambio D/E');repair.type='button';repair.onclick=()=>review(g.rowIdx,{gigPrice:g.current.location,location:String(g.current.gigPrice)}).catch(e=>status.textContent=e.message);row.append(repair);}list.append(row);}}
      catch(error){status.textContent=error.message;}finally{busy=false;button.disabled=false;}};
  };
})();
