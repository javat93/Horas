'use strict';
const { createHash } = require('node:crypto');
const C = require('../group-courses.js'), G = require('../group-identity.js');
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${C.TARGET}`, LIMIT = 10000;
const metaFields = 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties))';
const gridFields = 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties),data(startRow,startColumn,rowData(values(userEnteredValue))))';
const value = c => c?.userEnteredValue?.stringValue ?? c?.userEnteredValue?.boolValue ?? c?.userEnteredValue?.numberValue ?? '';
const cell = v => ({ userEnteredValue: typeof v === 'boolean' ? { boolValue: v } : { stringValue: v } });
const clean = r => ({ id: r.id, grupo: r.grupo, curso: r.curso, activo: r.activo, tipo: r.tipo, actualizadoEn: r.actualizadoEn });
const placeholder = r => r.every((v, i) => v === '' || (i === 3 && v === false));
function validate(p) {
  if (!p || !['load', 'save'].includes(p.action) || Object.keys(p).some(k => !(p.action === 'load' ? ['action'] : ['action', 'curso', 'updates', 'expectedVersion']).includes(k))) C.fail('Operación de cursos no permitida.');
  if (p.action === 'save') { C.course(p.curso); C.validateUpdates(p.updates); if (!/^[a-f0-9]{64}$/.test(p.expectedVersion || '')) C.fail('Falta la versión verificada.'); }
}
function layout(book) {
  if (book.spreadsheetId !== C.TARGET || book.properties?.locale !== 'es_ES' || book.properties?.timeZone !== 'Europe/Madrid') C.fail('Libro no reconocido.', 'SCHEMA_MISMATCH', 409);
  const sheets = {};
  for (const name of ['Coles', 'GruposCurso']) {
    const matches = book.sheets?.filter(s => s.properties?.title === name) || [], p = matches[0]?.properties;
    if (matches.length !== 1 || !p || !Number.isInteger(p.gridProperties?.rowCount) || p.gridProperties.rowCount < 2 || p.gridProperties.rowCount > LIMIT || p.gridProperties.columnCount < (name === 'Coles' ? 1 : 6) || (name === 'GruposCurso' && p.sheetId !== C.SHEET_ID)) C.fail('Falta verificar la pestaña ' + name, 'SCHEMA_MISMATCH', 409);
    sheets[name] = p;
  }
  return sheets;
}
async function snapshot(token, request, bounds) {
  const sheets = bounds || layout(await request(BASE + '?' + new URLSearchParams({ fields: metaFields }), token));
  const q = new URLSearchParams({ fields: gridFields, includeGridData: 'true' });
  for (const name of ['Coles', 'GruposCurso']) q.append('ranges', `${name}!A1:${name === 'Coles' ? 'A' : 'F'}${sheets[name].gridProperties.rowCount}`);
  const book = await request(BASE + '?' + q, token), fresh = layout(book);
  if (Object.keys(sheets).some(n => sheets[n].sheetId !== fresh[n].sheetId || sheets[n].gridProperties.rowCount !== fresh[n].gridProperties.rowCount)) C.fail('La estructura ha cambiado. Actualiza antes de guardar.', 'REVIEW_EXPIRED', 409);
  const rows = {};
  for (const name of ['Coles', 'GruposCurso']) {
    const width = name === 'Coles' ? 1 : 6;
    rows[name] = Array.from({ length: sheets[name].gridProperties.rowCount }, () => Array(width).fill(''));
    for (const grid of book.sheets.find(s => s.properties.sheetId === sheets[name].sheetId).data || []) {
      if (grid.startColumn) C.fail('Lectura no reconocida.', 'SCHEMA_MISMATCH', 409);
      for (const [i, row] of (grid.rowData || []).entries()) {
        const index = (grid.startRow || 0) + i; if (index >= rows[name].length) C.fail('Lectura fuera de rango.');
        rows[name][index] = Array.from({ length: width }, (_, col) => { const c = row.values?.[col]; if (c?.userEnteredValue?.formulaValue) C.fail('No se admiten fórmulas en la organización por curso.', 'SCHEMA_MISMATCH', 409); return value(c); });
      }
    }
  }
  if (rows.Coles[0][0] !== 'Grupo' || JSON.stringify(rows.GruposCurso[0]) !== JSON.stringify(C.HEADERS)) C.fail('Cabeceras no reconocidas.', 'SCHEMA_MISMATCH', 409);
  const groups = rows.Coles.slice(1).filter(r => typeof r[0] === 'string' && r[0].trim()).map(r => ({ id: G.id(r[0]), nombre: r[0], label: G.catalogLabel(r[0]) }));
  const records = [], issues = [], keys = new Set(), groupIds = new Set();
  for (const g of groups) { if (groupIds.has(g.id)) issues.push('Grupo duplicado: ' + g.label); groupIds.add(g.id); }
  for (const [i, r] of rows.GruposCurso.entries()) {
    if (!i || placeholder(r)) continue;
    try {
      const record = { id: r[0], grupo: r[1], curso: C.course(r[2]), activo: r[3], tipo: r[4], actualizadoEn: r[5], rowIdx: i + 1 };
      C.validateUpdates([{ grupo: record.grupo, activo: record.activo, tipo: record.tipo }]);
      if (record.id !== G.id(record.grupo) || typeof record.actualizadoEn !== 'string' || !Number.isFinite(Date.parse(record.actualizadoEn)) || keys.has(C.key(record))) C.fail('Registro duplicado o no válido.');
      keys.add(C.key(record)); records.push(record);
    } catch (e) { issues.push('Fila ' + (i + 1) + ': ' + e.message); }
  }
  const version = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  return { sheets, rows, groups, records, issues, version };
}
function response(s) { return { mode: 'group-courses-production', spreadsheetId: C.TARGET, calendarModified: false, legacyModified: false, version: s.version, groups: s.groups, records: s.records.map(clean), issues: s.issues }; }
async function execute(p, token, request, now) {
  validate(p); const s = await snapshot(token, request); if (p.action === 'load') return response(s);
  if (s.issues.length) C.fail('Revisa las incidencias de GruposCurso.', 'DATA_ISSUES', 409);
  if (p.expectedVersion !== s.version) C.fail('La organización ha cambiado. Actualiza y revisa tu selección.', 'REVIEW_EXPIRED', 409);
  const reserved = new Set(), writes = [];
  for (const u of p.updates) {
    const matches = s.groups.filter(g => G.same(g.nombre, u.grupo)); if (matches.length !== 1) C.fail('Grupo no encontrado o duplicado.', 'NOT_FOUND', 404);
    const g = matches[0], before = C.classification(s.records, g, p.curso);
    if (before && before.activo === u.activo && before.tipo === u.tipo) continue;
    const index = before ? before.rowIdx - 1 : s.rows.GruposCurso.findIndex((r, i) => i > 0 && placeholder(r) && !reserved.has(i));
    if (index < 0) C.fail('La pestaña de cursos está llena.', 'CAPACITY', 409); reserved.add(index);
    writes.push({ index, record: { id: g.id, grupo: g.nombre, curso: p.curso, activo: u.activo, tipo: u.tipo, actualizadoEn: now.toISOString() } });
  }
  if (!writes.length) return { ...response(s), rowsChanged: 0 };
  const fresh = await snapshot(token, request, s.sheets); if (fresh.version !== s.version) C.fail('Han cambiado los datos. Actualiza antes de guardar.', 'REVIEW_EXPIRED', 409);
  const requests = writes.map(w => ({ updateCells: { range: { sheetId: C.SHEET_ID, startRowIndex: w.index, endRowIndex: w.index + 1, startColumnIndex: 0, endColumnIndex: 6 }, rows: [{ values: Object.values(clean(w.record)).map(cell) }], fields: 'userEnteredValue' } }));
  try {
    await request(BASE + ':batchUpdate', token, 'POST', { requests });
    const after = await snapshot(token, request, fresh.sheets);
    if (after.issues.length || writes.some(w => JSON.stringify(clean(after.records.find(r => C.key(r) === C.key(w.record)) || {})) !== JSON.stringify(clean(w.record)))) throw Error('La relectura no coincide.');
    return { ...response(after), rowsChanged: writes.length };
  } catch (e) { const quota = e.status === 429 || /quota|cuota|rate.?limit/i.test(e.message || ''); C.fail(quota ? 'Se ha alcanzado la cuota de Google al guardar o verificar. Espera un minuto, actualiza y revisa antes de reenviar.' : 'No se ha podido confirmar el guardado. Actualiza y revisa antes de reenviar.', 'WRITE_UNCERTAIN', quota ? 429 : 503); }
}
function createService() {
  let pending = Promise.resolve();
  return { run(p, token, request, now = new Date()) { try { validate(p); } catch (e) { return Promise.reject(e); } if (p.action === 'load') return execute(p, token, request, now); const job = pending.then(() => execute(p, token, request, now)); pending = job.catch(() => {}); return job; } };
}
module.exports = { BASE, validate, snapshot, createService };
