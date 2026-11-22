document.addEventListener('DOMContentLoaded',async()=>{
 await window.horasConfigReady;
 const vault=window.horasDraftVault=DraftVault.create(localStorage,CONFIG.DATA_MODE+':'+CONFIG.SPREADSHEET_ID,Date.now,()=>{document.getElementById('auth-status').textContent='No se pudo conservar el borrador en este dispositivo. Mantén abierta la app hasta verificar el guardado.';});
 const host=document.createElement('section');host.className='draft-recovery';host.setAttribute('aria-label','Borradores en este dispositivo');document.querySelector('main').prepend(host);
 const forms=[['form-evento','modal-evento','ev-rowIdx'],['form-grupo','modal-grupo','gr-rowIdx']];let restoring=false;
 const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function formKey(id,row){return 'form:'+id+':'+(row||'new');}
 function restoreFields(form,record){
   if(record.form==='form-evento'){document.getElementById('ev-all-groups').checked=true;populateSelects();}
   for(const [id,value]of Object.entries(record.fields||{})){const n=document.getElementById(id);if(n&&form.contains(n)&&!n.disabled){if(n.type==='checkbox')n.checked=value===true;else if(n.type!=='hidden')n.value=String(value);}}
   if(record.form==='form-evento'){refreshGroupLabels();toggleRecurrence();}
 }
 function draw(){host.replaceChildren();const records=vault.list().filter(r=>r.kind.startsWith('form:'));if(!records.length)return;
   const details=make('details'),summary=make('summary',records.length+' borrador(es) recuperable(s) en este dispositivo');details.append(summary,make('p','Se conservan hasta 7 días. Recuperar no guarda en Google. Revisa siempre el formulario.'));
   for(const {kind,value}of records){const line=make('div'),open=make('button',(value.form==='form-evento'?'Sesión':'Grupo')+(value.row?' · fila '+value.row:' · nuevo')),discard=make('button','Descartar');open.type=discard.type='button';
    open.onclick=()=>{let connected=false;try{connected=!!window.horasAccessToken?.();}catch{}if(!connected){document.getElementById('auth-status').textContent='Conecta Google antes de recuperar y revisar el borrador.';return;}restoring=true;try{if(value.form==='form-evento'){if(value.row){if(!eventos.some(e=>e.rowIdx===Number(value.row)))throw Error('La sesión ya no está disponible. Actualiza los datos y revisa el borrador.');openEditSesionModal(Number(value.row));}else openNewSesionModal();}else{if(value.row)openEditGrupoModal(Number(value.row));else openNewGrupoModal();}restoreFields(document.getElementById(value.form),value);}catch(e){document.getElementById('auth-status').textContent=e.message;}finally{restoring=false;}};
    discard.onclick=()=>{vault.remove(kind);draw();};line.append(open,discard);details.append(line);
   }host.append(details);
 }
 for(const [id,modal,rowId]of forms){const form=document.getElementById(id);if(!form)continue;const capture=event=>{if(event?.target?.id==='ev-all-groups')return;if(restoring||document.getElementById(modal).classList.contains('hidden'))return;const fields={};for(const n of form.querySelectorAll('input[id],select[id],textarea[id]'))if(n.type!=='hidden'&&!n.disabled&&!/token|password|secret/i.test(n.id))fields[n.id]=n.type==='checkbox'?n.checked:n.value;const row=document.getElementById(rowId).value;const ok=vault.save(formKey(id,row),{form:id,row,fields});if(!ok)document.getElementById('auth-status').textContent='No se pudo conservar el borrador en este dispositivo. Mantén abierta la app hasta verificar el guardado.';draw();};form.addEventListener('input',capture);form.addEventListener('change',capture);}
 window.horasDrafts={clearForm(kind,row){vault.remove(formKey(kind==='group'?'form-grupo':'form-evento',row));draw();},refresh:draw};
 window.dispatchEvent(new Event('draft-vault-ready'));draw();
});
