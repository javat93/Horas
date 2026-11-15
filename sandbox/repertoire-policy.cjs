'use strict';
// Fixed destination. This module deliberately does not import the legacy profiles.
const DEVELOPMENT_ID = '1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k';
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${DEVELOPMENT_ID}`;
const LIMIT = 10000;
const M = require('../repertoire-model.js');
function destination(payload) {
  if (payload.spreadsheetId !== undefined && payload.spreadsheetId !== DEVELOPMENT_ID) M.fail('Destino bloqueado: solo la copia de repertorio.', 'FORBIDDEN_TARGET', 403);
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
      const gridFields = 'spreadsheetId,sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue))))';
      if (u.searchParams.get('fields') !== (u.searchParams.get('includeGridData') === 'true' ? gridFields : metadataFields)) M.fail('Campos de lectura bloqueados.', 'FORBIDDEN_RANGE', 403);
    } else if (method === 'POST' && u.href === BASE + ':batchUpdate') {
      if (!body || Object.keys(body).some(k => k !== 'requests') || !Array.isArray(body.requests) || !body.requests.length || body.requests.length > 100) M.fail('Lote no permitido.', 'FORBIDDEN_WRITE', 403);
      for (const item of body.requests) {
        if (Object.keys(item).length !== 1 || !item.updateCells) M.fail('Solo se permite actualizar celdas del repertorio.', 'FORBIDDEN_WRITE', 403);
        const c = item.updateCells, r = c.range;
        if (!r || Object.keys(c).some(k => !['range', 'rows', 'fields'].includes(k)) || ![142601101, 142601102].includes(r.sheetId)) M.fail('Pestaña de escritura bloqueada.', 'FORBIDDEN_WRITE', 403);
        const width = r.sheetId === 142601101 ? 8 : 13;
        if (Object.keys(r).some(k => !['sheetId', 'startRowIndex', 'endRowIndex', 'startColumnIndex', 'endColumnIndex'].includes(k)) || !Number.isInteger(r.startRowIndex) || r.startRowIndex < 1 || r.endRowIndex !== r.startRowIndex + 1 || r.endRowIndex > LIMIT || !Number.isInteger(r.startColumnIndex) || r.startColumnIndex < 0 || !Number.isInteger(r.endColumnIndex) || r.endColumnIndex > width || r.endColumnIndex <= r.startColumnIndex || !Array.isArray(c.rows) || c.rows.length !== 1 || c.rows[0].values?.length !== r.endColumnIndex - r.startColumnIndex || c.fields !== 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation') M.fail('Rango o máscara de escritura bloqueados.', 'FORBIDDEN_WRITE', 403);
      }
    } else M.fail('Operación remota bloqueada.', 'FORBIDDEN_TARGET', 403);
    return request(url, token, method, body);
  };
}
module.exports = { DEVELOPMENT_ID, BASE, LIMIT, destination, guardRequest };
