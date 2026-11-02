const ORIGINAL_ID = '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60';
const TEST_ID = '1breBD5aoBR4i9yiPJUKZC2Ouk0rvFOlRmwgJk4bUPwI';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/spreadsheets';
const {AsyncLocalStorage}=require('node:async_hooks');
const profiles=new AsyncLocalStorage();
const REHEARSAL_ID='1UrFyj4uaAdJC7SKoYQYfQDo90laYhhcxKvmn5MXO9mo';
const TARGETS=Object.freeze({test:TEST_ID,rehearsal:REHEARSAL_ID,production:ORIGINAL_ID});
function targetId(){return TARGETS[profiles.getStore()||'test'];}
function withProfile(profile,work){
  if(!Object.hasOwn(TARGETS,profile))throw Error('Perfil protegido no permitido.');
  return profiles.run(profile,work);
}

function validateTarget(id) {
  if (id !== targetId()) throw new Error('Destino bloqueado: no coincide con el perfil protegido.');
}
function validateOperation(api, method, params = {}) {
  if (api === 'sheets') {
    validateTarget(params.spreadsheetId);
    if (method !== 'get') throw new Error('Fase 1: las escrituras de la aplicación están bloqueadas. Usa la prueba de aislamiento.');
    if (!params.range || typeof params.range !== 'string') throw new Error('Falta el rango de lectura.');
  } else if (api === 'calendar') {
    if (method !== 'list') throw new Error('Calendar está en modo de solo lectura.');
    if (params.calendarId !== 'primary') throw new Error('Calendario no permitido.');
  } else throw new Error('API no permitida.');
}
module.exports = { ORIGINAL_ID, TEST_ID, REHEARSAL_ID, SCOPES, targetId, withProfile, validateTarget, validateOperation };
