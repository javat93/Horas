'use strict';
// Fixed destination. This module deliberately does not import the legacy profiles.
const DEVELOPMENT_ID = '1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k';
const LIMIT = 10000;
const M = require('../repertoire-model.js');
function createPolicy(profile = 'development') {
  if (!['development', 'production'].includes(profile)) throw Error('Perfil de repertorio no permitido.');
  const TARGET_ID = profile === 'production' ? '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60' : DEVELOPMENT_ID;
  const SHEET_IDS = profile === 'production' ? { Temas: 155111501, GrupoTemas: 155111502 } : { Temas: 142601101, GrupoTemas: 142601102 };
  const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${TARGET_ID}`;
function destination(payload) {
  if (payload.spreadsheetId !== undefined && payload.spreadsheetId !== TARGET_ID) M.fail('Destino de repertorio bloqueado.', 'FORBIDDEN_TARGET', 403);
}
function guardRequest(request) {
  return async (url, token, method = 'GET', body) => {
    const u = new URL(url);
    if (u.origin !== 'https://sheets.googleapis.com' || u.username || u.password || u.hash) M.fail('Destino remoto bloqueado.', 'FORBIDDEN_TARGET', 403);
    if (method === 'GET' && u.pathname === new URL(BASE).pathname) {
      for (const key of u.searchParams.keys()) if (!['fields', 'includeGridData', 'ranges'].includes(key)) M.fail('Consulta no permitida.', 'FORBIDDEN_RANGE', 403);
      for (const range of u.searchParams.getAll('ranges')) if (!/^(?:Temas!A1:H|GrupoTemas!A1:M|Coles!A1:A)[1-9]\d*$/.test(range) || +range.match(/\d+$/)[0] > LIMIT) M.fail('Rango bloqueado.', 'FORBIDDEN_RANGE', 403);
      // Metadata must never be able to return all grid data implicitly.
      if (u.searchParams.get('includeGridData') === 'true' && !u.searchParams.getAll('ranges').length) M.fail('Faltan rangos acotados.', 'FORBIDDEN_RANGE', 403);
      const metadataFields = 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties))';
      const gridFields = 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue))))';
      if (u.searchParams.get('fields') !== (u.searchParams.get('includeGridData') === 'true' ? gridFields : metadataFields)) M.fail('Campos de lectura bloqueados.', 'FORBIDDEN_RANGE', 403);
    } else if (method === 'POST' && u.href === BASE + ':batchUpdate') {
      if (!body || Object.keys(body).some(k => k !== 'requests') || !Array.isArray(body.requests) || !body.requests.length || body.requests.length > 100) M.fail('Lote no permitido.', 'FORBIDDEN_WRITE', 403);
      for (const item of body.requests) {
        if (Object.keys(item).length !== 1 || !item.updateCells) M.fail('Solo se permite actualizar celdas del repertorio.', 'FORBIDDEN_WRITE', 403);
        const c = item.updateCells, r = c.range;
        if (!r || Object.keys(c).some(k => !['range', 'rows', 'fields'].includes(k)) || !Object.values(SHEET_IDS).includes(r.sheetId)) M.fail('Pestaña de escritura bloqueada.', 'FORBIDDEN_WRITE', 403);
        const width = r.sheetId === SHEET_IDS.Temas ? 8 : 13;
        if (Object.keys(r).some(k => !['sheetId', 'startRowIndex', 'endRowIndex', 'startColumnIndex', 'endColumnIndex'].includes(k)) || !Number.isInteger(r.startRowIndex) || r.startRowIndex < 1 || r.endRowIndex !== r.startRowIndex + 1 || r.endRowIndex > LIMIT || !Number.isInteger(r.startColumnIndex) || r.startColumnIndex < 0 || !Number.isInteger(r.endColumnIndex) || r.endColumnIndex > width || r.endColumnIndex <= r.startColumnIndex || !Array.isArray(c.rows) || c.rows.length !== 1 || c.rows[0].values?.length !== r.endColumnIndex - r.startColumnIndex || c.fields !== 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation') M.fail('Rango o máscara de escritura bloqueados.', 'FORBIDDEN_WRITE', 403);
      }
    } else M.fail('Operación remota bloqueada.', 'FORBIDDEN_TARGET', 403);
    return request(url, token, method, body);
  };
}
return { DEVELOPMENT_ID, TARGET_ID, SHEET_IDS: Object.freeze(SHEET_IDS), MODE: 'repertoire-' + profile, BASE, LIMIT, destination, guardRequest };
}
module.exports = { ...createPolicy(), createPolicy };
