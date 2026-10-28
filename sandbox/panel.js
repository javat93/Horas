window.horasEnvironmentReady = new Promise(resolveEnvironment => {
document.addEventListener('DOMContentLoaded', async () => {
  await window.horasConfigReady;
  if(!CONFIG.TEST_MODE){resolveEnvironment(true);return;}
  if(!document.getElementById('test-environment-banner')){
    const banner=document.createElement('div');
    banner.id='test-environment-banner';
    banner.style.cssText='padding:16px;background:#fff3cd;color:#312a12;position:relative;z-index:100';
    banner.innerHTML='<strong>PRUEBAS — Fase 2 — Calendar solo lectura</strong><div>Hoja: Horas Fran — PRUEBAS — 28-10-2026</div><div id="test-target-status">Comprobando destino del backend…</div><button id="test-reload" type="button">Recargar copia</button> · <button id="test-control" type="button">Probar escritura y restauración en la copia</button><div id="test-result" role="status" aria-live="polite"></div>';
    document.body.prepend(banner);
  }
  const status=document.getElementById('test-target-status');
  const result=document.getElementById('test-result');
  const control=document.getElementById('test-control');
  control.disabled=true;
  document.getElementById('auth-btn')?.addEventListener('click',()=>{
    setTimeout(()=>{
      if(!localStorage.getItem('g_token_pruebas')){
        hideLoading();
        result.textContent='La conexión de Google sigue pendiente. Si no se abrió la ventana de acceso, abre esta dirección en tu navegador habitual y pulsa «Conectar Google». No se ha escrito nada.';
      }
    },15000);
  });
  // Evitar formularios y sincronizaciones con efectos parciales en esta fase.
  for (const id of ['form-evento','form-grupo','form-future-events']) {
    document.getElementById(id)?.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();result.textContent='La edición se habilitará al probar las siguientes fases.';},true);
  }
  for (const id of ['sync-btn','add-future-events-btn']) {
    const button=document.getElementById(id);if(button) {button.disabled=true;button.title='Bloqueado durante la fase 1';}
  }
  // Incluye acciones inline de pago y borrado antes de que alteren la interfaz.
  document.addEventListener('click',e=>{
    const target=e.target.closest('[onclick]');
    if(target && /togglePago\(|confirmarBorrar\(/.test(target.getAttribute('onclick'))){e.preventDefault();e.stopImmediatePropagation();result.textContent='Edición y borrado bloqueados durante la fase 1.';}
  },true);
  try {
    const response=await fetch(CONFIG.TEST_ENVIRONMENT_API_URL || `${CONFIG.PROXY_URL}/api/test-environment`);
    const env=await response.json();
    if(!response.ok || env.mode!=='test' || env.spreadsheetId!==CONFIG.SPREADSHEET_ID || !env.calendarReadOnly || env.automaticWrites || env.appWrites) throw new Error('El backend no coincide con la configuración de pruebas.');
    if(CONFIG.TEST_PHASE===2 && (env.phase!==2||!env.linkReview))throw new Error('El backend aún no está preparado para la fase 2. Recarga en unos instantes.');
    status.textContent=`Backend comprobado: ${env.spreadsheetId}. Solo se pueden guardar vínculos revisados; precios y Calendar no cambian.`;
    control.disabled=false;
    resolveEnvironment(true);
    window.mountCalendarReview?.(document.getElementById('test-environment-banner'));
  } catch(error){status.textContent=error.message;resolveEnvironment(false);return;}
  document.getElementById('test-reload').onclick=()=>syncData(false,false);
  control.onclick=async()=>{
    const token=gapi.client?.getToken()?.access_token || localStorage.getItem('g_token_pruebas');
    if(!token){result.textContent='Primero pulsa «Conectar Google». No se ha escrito nada.';return;}
    control.disabled=true;
    result.textContent='Creando una pestaña temporal en la copia, verificando el valor 42 y retirándola…';
    try {
      const response=await fetch(CONFIG.TEST_CONTROL_API_URL || `${CONFIG.PROXY_URL}/api/test-control`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Falló la prueba de aislamiento.');
      if(data.spreadsheetId!==CONFIG.SPREADSHEET_ID || !data.restored || data.valueVerified!==42 || data.calendarModified)throw new Error('Resultado de prueba inesperado.');
      result.textContent='Prueba correcta: valor 42 escrito y leído en la copia; pestaña temporal eliminada. Calendar sin cambios.';
    } catch(error){result.textContent=error.message;}
    finally{control.disabled=false;}
  };
});
});
