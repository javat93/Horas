(function(){
  let busy=false,blocked=false,lastRun=0,beforeRow=0;
  const notice=text=>{const el=document.getElementById('performed-status');if(el)el.textContent=text;};
  window.runAutoPerformed=async function(){
    if(!CONFIG.TEST_MODE||CONFIG.TEST_PHASE<8||busy||blocked||document.hidden||Date.now()-lastRun<60000)return;
    if(!eventos.some(e=>!e.realizado&&!e.autoExcluded&&!e.dateWarning&&e.calEventId&&e.horaFin))return;
    if(window.horasOperationBusy?.())return;
    busy=true;lastRun=Date.now();
    try{
      if(!await window.horasEnvironmentReady)return;
      const token=window.horasAccessToken();if(!token)return;
      const response=await window.horasFetch(CONFIG.STATE_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,action:'autoPerformed',beforeRow})});
      const result=await AppData.readResponse(response);
      if(result.spreadsheetId!==CONFIG.SPREADSHEET_ID||result.calendarModified!==false||!Array.isArray(result.performed))throw Error('Falta confirmar el marcado automático.');
      beforeRow=result.nextCursor||0;
      for(const saved of result.performed){const ev=eventos.find(e=>e.rowIdx===saved.rowIdx);if(ev){ev.realizado=true;ev.sourceVersion=saved.version;}}
      if(result.rowsChanged){renderAll();updateFinancialStats();notice(`Realizado: ${result.rowsChanged} sesión(es) marcadas y verificadas. Calendar sin cambios.`);}
    }catch(error){blocked=true;notice(`Realizado automático detenido: ${error.message} Recarga la página para comprobar los datos antes de reintentarlo.`);}
    finally{busy=false;}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const status=document.createElement('p');status.id='performed-status';status.setAttribute('role','status');
    status.textContent='Realizado automático al terminar (hora de Madrid), al abrir la app o mientras siga abierta. Solo sesiones con evento amarillo verificado y fecha y horario seguros. Cancelaciones y discrepancias quedan pendientes. Para una excepción, escribe NO en Detalle, columna O; no se usará H como duración.';
    window.horasEnvironmentReady.then(ready=>{if(ready)document.getElementById('test-environment-banner')?.append(status);});
    setInterval(()=>window.runAutoPerformed(),60000);
  });
})();
