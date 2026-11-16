'use strict';
const C = require('../../group-courses.js'), S = require('../group-courses-service.cjs');
function fixture({ groups = ['Slap Lunes', 'La Maquinista', 'Taller puntual'], rowCount = 40 } = {}) {
  const f = require('./repertoire.cjs').fixture({ groups, rowCount });
  f.book.spreadsheetId = C.TARGET;
  const rows = Array.from({ length: rowCount }, () => ({ values: Array.from({ length: 6 }, () => ({})) }));
  for (const row of rows.slice(1)) row.values[3] = { userEnteredValue: { boolValue: false } };
  rows[0].values = C.HEADERS.map(v => ({ userEnteredValue: { stringValue: v } }));
  f.book.sheets.push({ properties: { sheetId: C.SHEET_ID, title: 'GruposCurso', gridProperties: { rowCount, columnCount: 6 } }, data: [{ startRow: 0, startColumn: 0, rowData: rows }] });
  f.service = S.createService(); f.run = p => f.service.run(p, 'Bearer synthetic', f.request, new Date('2026-11-16T10:00:00Z'));
  f.read = () => f.run({ action: 'load' });
  f.save = async (curso, updates) => f.run({ action: 'save', curso, updates, expectedVersion: (await f.read()).version });
  return f;
}
module.exports = { fixture };
