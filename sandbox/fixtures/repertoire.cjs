'use strict';
const M = require('../../repertoire-model.js');
const P = require('../repertoire-policy.cjs');
const S = require('../repertoire-service.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const theme = (n = 1, changes = {}) => ({ id: id(n), nombre: 'Tema ' + n, numeroOrden: n, temaGaleta: true, temaSlap: false, temaPropio: false, activo: true, notas: '', ...changes });
function fixture({ groups = ['Grupo A', 'Grupo B', 'Moli de finestrelles'], rowCount = 20 } = {}) {
  const cells = v => ({ userEnteredValue: { stringValue: v } });
  const book = { spreadsheetId: P.DEVELOPMENT_ID, properties: { locale: 'es_ES', timeZone: 'Europe/Madrid' }, sheets: [] };
  for (const [name, sheetId, headers] of [['Temas', 142601101, M.HEADERS.Temas], ['GrupoTemas', 142601102, M.HEADERS.GrupoTemas], ['Coles', 758405382, ['Grupo']]]) {
    const rows = Array.from({ length: rowCount }, () => ({ values: Array.from({ length: headers.length }, () => ({})) }));
    rows[0] = { values: headers.map(cells) };
    if (name === 'Coles') groups.forEach((g, i) => { rows[i + 1] = { values: [cells(g)] }; });
    else for (const r of rows.slice(1)) for (const col of name === 'Temas' ? [3, 4, 5, 6] : [4, 5, 12]) r.values[col] = { userEnteredValue: { boolValue: false }, effectiveValue: { boolValue: false } };
    book.sheets.push({ properties: { title: name, sheetId, gridProperties: { rowCount, columnCount: headers.length } }, data: [{ startRow: 0, startColumn: 0, rowData: rows }] });
  }
  const calls = [], f = { book, calls, onRead: null, afterWrite: null, failAfterWrite: false };
  f.request = async (url, token, method = 'GET', body) => {
    calls.push({ url, method, body: structuredClone(body) });
    if (method === 'GET') {
      if (f.onRead) f.onRead(calls.length);
      if (!new URL(url).searchParams.has('includeGridData')) return { ...structuredClone(book), sheets: book.sheets.map(s => ({ properties: structuredClone(s.properties) })) };
      return structuredClone(book);
    }
    for (const item of body.requests) {
      const u = item.updateCells;
      const sheet = book.sheets.find(s => s.properties.sheetId === u.range.sheetId);
      const dest = sheet.data[0].rowData[u.range.startRowIndex].values;
      for (const [i, c] of u.rows[0].values.entries()) dest[u.range.startColumnIndex + i] = structuredClone(c);
    }
    // Minimal evaluation in simulated Google. Actual es_ES calculation is tested separately on the copy.
    for (const sheet of book.sheets) for (const r of sheet.data[0].rowData.slice(1)) for (const c of r.values) {
      const v = c.userEnteredValue;
      if (v?.formulaValue) {
        const themeId = r.values[2]?.userEnteredValue?.stringValue;
        const t = book.sheets[0].data[0].rowData.find(r => r.values[0]?.userEnteredValue?.stringValue === themeId);
        c.effectiveValue = { stringValue: t?.values[1]?.userEnteredValue?.stringValue || 'Tema no encontrado' };
      } else c.effectiveValue = structuredClone(v || {});
    }
    if (f.afterWrite) f.afterWrite();
    if (f.failAfterWrite) throw Error('Se perdió la respuesta');
    return {};
  };
  f.run = payload => S.runRepertoire(payload, 'Bearer simulated', f.request, new Date('2026-11-15T23:30:00.000Z'));
  f.read = () => f.run({ action: 'validate' });
  f.apply = async payload => f.run({ ...payload, expectedVersion: (await f.read()).version });
  f.seed = async () => { await f.apply({ action: 'saveTheme', theme: theme() }); return f.apply({ action: 'assignThemes', grupo: groups[0], assignments: [{ id: id(101), temaId: id(1) }] }); };
  return f;
}
module.exports = { fixture, id, theme };
