const ORIGINAL_ID = '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60';
const TEST_ID = '1breBD5aoBR4i9yiPJUKZC2Ouk0rvFOlRmwgJk4bUPwI';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/spreadsheets';

function validateTarget(id) {
  if (id !== TEST_ID || id === ORIGINAL_ID) throw new Error('Destino bloqueado: solo se permite la copia de pruebas.');
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
module.exports = { ORIGINAL_ID, TEST_ID, SCOPES, validateTarget, validateOperation };
