(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HorasProtectedConfig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ids=Object.freeze({test:'1breBD5aoBR4i9yiPJUKZC2Ouk0rvFOlRmwgJk4bUPwI',rehearsal:'1UrFyj4uaAdJC7SKoYQYfQDo90laYhhcxKvmn5MXO9mo',production:'1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60'});
  function create(mode){
    if(!Object.hasOwn(ids,mode))throw Error('Modo protegido desconocido.');
    const origin='https://horas-git-main-javat93s-projects.vercel.app',endpoint=origin+'/api/'+(mode==='test'?'test':'production');
    const c={API_KEY:null,CLIENT_ID:'367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',SPREADSHEET_ID:ids[mode],SPREADSHEET_NAME:mode==='production'?'Horas Fran':mode==='rehearsal'?'Ensayo protegido':'Horas Fran — PRUEBAS — 28-10-2026',DATA_MODE:mode,PROTECTED_MODE:true,TEST_MODE:mode==='test',TEST_PHASE:8,SCOPES:'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/spreadsheets',DISCOVERY_DOCS:['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest','https://sheets.googleapis.com/$discovery/rest?version=v4'],PROXY_URL:origin,GOOGLE_MAPS_API_URL:origin+'/api/maps',USE_PROXY:true,ENVIRONMENT:'production'};
    for(const [key,api]of Object.entries({DAILY_API_URL:'daily',STATE_API_URL:'state',GROUPS_API_URL:'groups',LOCALE_API_URL:'locale',PROTECTED_REVIEW_API_URL:'protected',CALENDAR_LINKS_API_URL:'links',GOOGLE_SHEETS_API_URL:'sheets',GOOGLE_CALENDAR_API_URL:'calendar',TEST_ENVIRONMENT_API_URL:'environment',TEST_CONTROL_API_URL:'control'}))c[key]=endpoint+'?api='+api;
    return Object.freeze(c);
  }
  function verify(config,env){
    const mode=config.DATA_MODE||'test';
    if(env.mode!==mode||env.spreadsheetId!==config.SPREADSHEET_ID||!env.calendarReadOnly||env.appWrites!==false)throw Error('El destino del backend no coincide con la configuración. No se habilitarán cambios.');
    if(mode!=='test'&&(ids[mode]!==config.SPREADSHEET_ID||env.protectedMode!==true||env.phase!==8||typeof env.writeEnabled!=='boolean'||env.automaticWrites!==env.writeEnabled))throw Error('Falta confirmar las protecciones del destino.');
    return true;
  }
  return {create,verify};
});
