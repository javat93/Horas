window.mountCalendarReview=function(banner){
  if(document.getElementById('calendar-link-review'))return;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const open=node('button','Revisar vínculos de Calendar');open.type='button';open.style.cssText='display:block;margin-top:12px;padding:8px 12px;border:1px solid currentColor;border-radius:6px;font-weight:bold';banner.append(open);
  const section=node('section');section.id='calendar-link-review';section.hidden=true;section.style.cssText='margin:20px auto;padding:20px;max-width:1100px;background:white;border:1px solid #cbd5e1;border-radius:12px';banner.after(section);
  section.append(node('h2','Revisión de vínculos — Fase 2'));
  section.append(node('p','Solo cambia CalendarId (columna K) en la copia. No cambia precios, fechas, horas, barrios ni Calendar. Las fechas se comparan como se muestran en la app; su saneamiento tendrá una fase propia.'));
  const message=node('p');message.setAttribute('role','status');section.append(message);
  const reload=node('button','Analizar de nuevo');reload.type='button';section.append(reload);
  const label=node('label',' Revisar fila: '),input=node('input');input.type='number';input.min='2';input.style.cssText='width:90px;border:1px solid #94a3b8;margin:8px;padding:4px';label.append(input);section.append(label);
  const inspect=node('button','Buscar fila');inspect.type='button';section.append(inspect);
  const list=node('div');section.append(list);let snapshot=null,busy=false;
  async function request(action,body={}){
    if(!await window.horasEnvironmentReady)throw new Error('El destino de pruebas no está verificado.');
    const token=window.horasAccessToken ? window.horasAccessToken() : gapi.client?.getToken()?.access_token||localStorage.getItem('g_token_pruebas');
    if(!token)throw new Error('Primero pulsa «Conectar Google». No se ha cambiado ningún vínculo.');
    const response=await (window.horasFetch||fetch)(CONFIG.CALENDAR_LINKS_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,action,...body})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo revisar el vínculo.');return data;
  }
  async function action(work){if(busy)return;busy=true;reload.disabled=true;inspect.disabled=true;open.disabled=true;try{await work();}catch(error){message.textContent=error.message;}finally{busy=false;reload.disabled=false;inspect.disabled=false;open.disabled=false;}}
  function describe(e){return `${e.title} · ${e.date||'sin fecha'} ${e.horaInicio||''}–${e.horaFin||''}${e.cancelled?' · cancelado/no disponible':''}${!e.yellow?' · no amarillo':''}`;}
  function rowCard(row,parent){
    const card=node('div');card.style.cssText='padding:12px 0;border-bottom:1px solid #e2e8f0';parent.append(card);
    card.append(node('p',`Fila ${row.rowIdx}: ${row.grupo||'(sin grupo)'} · ${row.fechaStr} · ${row.horaInicio||'?'}–${row.horaFin||'?'}`));
    const search=node('button','Buscar candidatos');search.type='button';card.append(search);const output=node('div');card.append(output);
    search.onclick=()=>action(async()=>{
      search.disabled=true;message.textContent='Consultando todas las páginas de Calendar…';
      try{
        const data=await request('candidates',{rowIdx:row.rowIdx,expectedRow:row.expectedRow});output.replaceChildren();
        if(data.current)output.append(node('p',`Vínculo actual: ${describe(data.current)}`));
        const statuses={matched:'Una coincidencia disponible: revísala antes de elegirla.',ambiguous:'Varias coincidencias: elige una o deja la fila pendiente.',claimed:'Candidato vinculado a otra fila. Resuelve primero el vínculo compartido.',unmatched:'Sin coincidencias seguras. No se creará ningún evento.'};
        output.append(node('p',statuses[data.status]));
        const select=node('select');select.setAttribute('aria-label',`Nuevo vínculo de la fila ${row.rowIdx}`);select.style.cssText='max-width:100%;border:1px solid #94a3b8;margin:8px 0;padding:6px';
        const pending=node('option','Selecciona una acción; no se guarda automáticamente');pending.value='pending';select.append(pending);
        if(row.calEventId){const clear=node('option','Dejar sin vincular (no borra Calendar)');clear.value='';select.append(clear);}
        for(const e of data.candidates){const option=node('option',describe(e)+(e.claimedBy.length?` · usado por fila(s) ${e.claimedBy.join(', ')}`:''));option.value=e.id;option.disabled=e.claimedBy.length>0;select.append(option);}
        output.append(select);
        const apply=node('button','Revisar cambio');apply.type='button';apply.style.marginLeft='8px';output.append(apply);
        const confirmation=node('div');output.append(confirmation);select.onchange=()=>confirmation.replaceChildren();
        apply.onclick=()=>{
          if(select.value==='pending'){message.textContent='Selecciona un evento o deja la fila sin vincular. No guardar conserva el estado actual.';return;}
          const newId=select.value;if(newId===row.calEventId){message.textContent='Ese ya es el vínculo actual. Sin cambios.';return;}
          confirmation.replaceChildren(node('p',`Solo K${row.rowIdx}: de ${row.calEventId||'(vacío)'} a ${newId||'(sin vincular)'}. Calendar no se modifica.`));
          const confirm=node('button','Confirmar vínculo en la copia');confirm.type='button';confirmation.append(confirm);
          const cancel=node('button','Cancelar');cancel.type='button';cancel.style.marginLeft='12px';confirmation.append(cancel);cancel.onclick=()=>{confirmation.replaceChildren();message.textContent='Cancelado. No se ha escrito nada.';};
          confirm.onclick=()=>action(async()=>{
            confirm.disabled=true;
            try{const saved=await request('apply',{rowIdx:row.rowIdx,expectedRow:row.expectedRow,newEventId:newId});
              if(saved.unchanged){message.textContent='El vínculo ya era el seleccionado. Sin cambios.';return;}
              const notice=document.getElementById('test-result'),text=`Guardado y verificado en ${saved.range}. Calendar y demás columnas sin cambios.`;notice.textContent=message.textContent=text;confirm.hidden=true;
              try{await analyze();await syncData(false,false);}catch(error){notice.textContent=text+' Falta refrescar la vista: '+error.message;}
            }finally{confirm.disabled=false;}
          });
        };
        message.textContent='Elegir una opción no escribe nada: requiere confirmación.';
      }finally{search.disabled=false;}
    });
  }
  async function analyze(){
    message.textContent='Leyendo vínculos de la copia…';snapshot=await request('audit');list.replaceChildren();
    message.textContent=`${snapshot.shared.length} IDs compartidos · ${snapshot.missing.length} filas sin vínculo · ${snapshot.rows.length} registros. No se han realizado cambios.`;
    for(const group of snapshot.shared){const details=node('details');details.style.marginTop='12px';details.append(node('summary',`ID compartido por filas ${group.rows.map(r=>r.rowIdx).join(', ')}: ${group.rows.map(r=>r.grupo||'(sin grupo)').join(' / ')}`));list.append(details);for(const row of group.rows)rowCard(row,details);}
    if(snapshot.missing.length){const details=node('details');details.append(node('summary',`${snapshot.missing.length} filas sin CalendarId`));list.append(details);for(const row of snapshot.missing)rowCard(row,details);}
  }
  open.onclick=()=>{section.hidden=false;section.scrollIntoView({behavior:'smooth',block:'start'});action(analyze);};reload.onclick=()=>action(analyze);
  inspect.onclick=()=>action(async()=>{if(!snapshot)await analyze();const row=snapshot.rows.find(r=>r.rowIdx===Number(input.value));if(!row)throw new Error('No se encontró esa fila.');const details=node('details');details.open=true;details.append(node('summary',`Revisión individual: fila ${row.rowIdx}`));list.prepend(details);rowCard(row,details);message.textContent='Pulsa «Buscar candidatos» en la revisión individual.';});
};
