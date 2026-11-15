'use strict';
const { createHash } = require('node:crypto');
const M = require('../repertoire-model.js');
const G = require('../group-identity.js');
const D = require('../locale-data.js');
const P = require('./repertoire-policy.cjs');
const READ_ACTIONS = Object.freeze(['catalog', 'groupRepertoire', 'validate']);
const FIELDS = Object.freeze({
  catalog: ['includeArchived'], validate: [], groupRepertoire: ['grupo', 'includeArchived'],
  saveTheme: ['theme', 'expectedVersion'], assignThemes: ['grupo', 'assignments', 'expectedVersion'],
  updateProgress: ['vinculoId', 'changes', 'expectedVersion'], recordRehearsal: ['ids', 'date', 'expectedVersion'],
  markForReview: ['ids', 'motivoRepaso', 'proximoObjetivo', 'expectedVersion'],
  archiveTheme: ['temaId', 'activo', 'expectedVersion'], archiveAssignment: ['vinculoId', 'activo', 'expectedVersion']
});
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cleanTheme = t => Object.fromEntries(M.THEME_FIELDS.map(k => [k, t[k]]));
const cleanAssignment = a => Object.fromEntries(M.ASSIGNMENT_FIELDS.map(k => [k, a[k]]));
function validatePayload(p) {
  if (!p || !Object.hasOwn(FIELDS, p.action)) M.fail('Acción de repertorio no permitida.', 'INVALID_ACTION');
  P.destination(p);
  M.object(p, ['action', 'spreadsheetId', ...FIELDS[p.action]]);
  if (p.includeArchived !== undefined) M.bool(p.includeArchived);
  if (!READ_ACTIONS.includes(p.action) && (typeof p.expectedVersion !== 'string' || !/^[a-f0-9]{64}$/.test(p.expectedVersion))) M.fail('Falta la versión leída antes de guardar.');
  // Reject malformed requests before any remote request.
  if (p.action === 'saveTheme') M.theme(p.theme);
  if (['assignThemes', 'groupRepertoire'].includes(p.action)) M.text(p.grupo, 200, true);
  if (p.action === 'assignThemes') {
    if (!Array.isArray(p.assignments) || !p.assignments.length || p.assignments.length > 50) M.fail('Selecciona entre 1 y 50 temas.');
    const ids = new Set(), themes = new Set();
    for (const a of p.assignments) { M.object(a, ['id', 'temaId']); M.uuid(a.id); M.uuid(a.temaId); if (ids.has(a.id) || themes.has(a.temaId)) M.fail('Asignación repetida en el lote.'); ids.add(a.id); themes.add(a.temaId); }
  }
  if (['updateProgress', 'archiveAssignment'].includes(p.action)) M.uuid(p.vinculoId);
  if (p.action === 'archiveTheme') M.uuid(p.temaId);
  if (['archiveTheme', 'archiveAssignment'].includes(p.action)) M.bool(p.activo);
  if (p.action === 'updateProgress') {
    M.object(p.changes, ['realizado', 'repasando', 'fechaRealizado', 'ultimoRepaso', 'proximoObjetivo', 'motivoRepaso', 'notas']);
    if (!Object.keys(p.changes).length) M.fail('No hay cambios.');
    for (const [key, v] of Object.entries(p.changes)) {
      if (['realizado', 'repasando'].includes(key)) M.bool(v);
      else if (['fechaRealizado', 'ultimoRepaso'].includes(key)) M.date(v);
      else M.text(v);
    }
  }
  if (['markForReview', 'recordRehearsal'].includes(p.action)) {
    if (!Array.isArray(p.ids) || !p.ids.length || p.ids.length > 50 || new Set(p.ids).size !== p.ids.length) M.fail('Selecciona entre 1 y 50 relaciones únicas.');
    p.ids.forEach(M.uuid);
    for (const key of ['motivoRepaso', 'proximoObjetivo']) if (p[key] !== undefined) M.text(p[key]);
    if (p.date !== undefined && !M.date(p.date)) M.fail('Falta la fecha del repaso.');
  }
}
function cell(value) {
  return { userEnteredValue: value === '' ? undefined : typeof value === 'boolean' ? { boolValue: value } : typeof value === 'number' ? { numberValue: value } : { stringValue: value } };
}
function themeCells(t) {
  const row = [t.id, t.nombre, t.numeroOrden, t.temaGaleta, t.temaSlap, t.temaPropio, t.activo, t.notas].map(cell);
  for (const i of [3, 4, 5, 6]) row[i].dataValidation = { condition: { type: 'BOOLEAN' }, strict: true };
  row[2].userEnteredFormat = { numberFormat: { type: 'NUMBER', pattern: '0' } };
  row[2].dataValidation = { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, strict: true };
  return row;
}
function lookupFormula(row) { return `=IF(C${row}="";"";IFNA(VLOOKUP(C${row};Temas!$A$2:$B;2;FALSE);"Tema no encontrado"))`; }
function assignmentCells(a, rowIdx) {
  const row = [a.id, a.grupo, a.temaId, '', a.realizado, a.repasando, a.fechaRealizado ? D.serial(a.fechaRealizado) : '', a.ultimoRepaso ? D.serial(a.ultimoRepaso) : '', a.proximoObjetivo, a.motivoRepaso, a.notas, a.actualizadoEn, a.activo].map(cell);
  row[3] = { userEnteredValue: { formulaValue: lookupFormula(rowIdx) } };
  row[1].dataValidation = { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: '=Coles!$A$2:$A' }] }, strict: true, showCustomUi: true };
  for (const i of [4, 5, 12]) row[i].dataValidation = { condition: { type: 'BOOLEAN' }, strict: true };
  for (const i of [6, 7]) row[i].userEnteredFormat = { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } };
  return row;
}
async function snapshot(token, request) {
  const q = new URLSearchParams({ fields: 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties))' });
  const meta = await request(P.BASE + '?' + q, token);
  if (meta.spreadsheetId !== P.DEVELOPMENT_ID || meta.properties?.locale !== 'es_ES' || meta.properties?.timeZone !== 'Europe/Madrid') M.fail('Libro de desarrollo o configuración no reconocidos.', 'SCHEMA_MISMATCH', 409);
  const sheets = {};
  for (const name of ['Temas', 'GrupoTemas', 'Coles']) {
    const matches = meta.sheets?.filter(s => s.properties?.title === name) || [];
    const p = matches[0]?.properties;
    if (matches.length !== 1 || !p || !Number.isInteger(p.gridProperties?.rowCount) || p.gridProperties.rowCount < 2 || p.gridProperties.rowCount > P.LIMIT || (name !== 'Coles' && p.sheetId !== (name === 'Temas' ? 142601101 : 142601102)) || p.gridProperties.columnCount < (M.HEADERS[name]?.length || 1)) M.fail('Estructura no reconocida: ' + name, 'SCHEMA_MISMATCH', 409);
    sheets[name] = p;
  }
  const gridQuery = new URLSearchParams({ includeGridData: 'true', fields: 'spreadsheetId,sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue))))' });
  for (const name of ['Temas', 'GrupoTemas', 'Coles']) gridQuery.append('ranges', `${name}!A1:${name === 'Temas' ? 'H' : name === 'GrupoTemas' ? 'M' : 'A'}${sheets[name].gridProperties.rowCount}`);
  const result = await request(P.BASE + '?' + gridQuery, token);
  if (result.spreadsheetId !== P.DEVELOPMENT_ID) M.fail('Respuesta de otro libro.', 'FORBIDDEN_TARGET', 403);
  const rows = {};
  for (const name of ['Temas', 'GrupoTemas', 'Coles']) {
    const found = result.sheets?.filter(s => s.properties?.title === name && s.properties?.sheetId === sheets[name].sheetId) || [];
    if (found.length !== 1) M.fail('Falta verificar ' + name, 'SCHEMA_MISMATCH', 409);
    const width = M.HEADERS[name]?.length || 1;
    rows[name] = Array.from({ length: sheets[name].gridProperties.rowCount }, () => Array.from({ length: width }, () => ({})));
    for (const grid of found[0].data || []) {
      if ((grid.startColumn || 0) !== 0) M.fail('Bloque de lectura no reconocido.', 'SCHEMA_MISMATCH', 409);
      for (const [i, r] of (grid.rowData || []).entries()) {
        const index = (grid.startRow || 0) + i;
        if (index >= rows[name].length) M.fail('Lectura fuera de rango.', 'SCHEMA_MISMATCH', 409);
        rows[name][index] = Array.from({ length: width }, (_, col) => r.values?.[col] || {});
      }
    }
  }
  if (M.value(rows.Coles[0][0]) !== 'Grupo') M.fail('Cabecera de grupos no reconocida.', 'SCHEMA_MISMATCH', 409);
  const groups = rows.Coles.slice(1).map(r => M.value(r[0])).filter(v => typeof v === 'string' && v.trim());
  const parsed = M.fromCells(rows);
  const issues = [...parsed.issues, ...M.integrity(parsed.themes, parsed.assignments, groups)];
  const version = hash(Object.entries(rows).map(([name, records]) => [name, records.map(r => r.map((c, col) => name === 'GrupoTemas' && col === 3 ? null : c.userEnteredValue || {}))]));
  return { ...parsed, issues, groups, rows, sheets, version };
}
function response(snap) {
  return { mode: 'repertoire-development', spreadsheetId: P.DEVELOPMENT_ID, calendarModified: false, legacyModified: false, version: snap.version,
    groups: snap.groups.map(nombre => ({ nombre, label: G.catalogLabel(nombre), id: G.id(nombre) })),
    themes: snap.themes.map(cleanTheme), assignments: snap.assignments.map(a => ({ ...cleanAssignment(a), estado: M.state(a) })), issues: snap.issues };
}
function plan(p, snap, now) {
  if (snap.issues.length) M.fail('Hay incidencias del repertorio pendientes de revisar. Consulta validate.', 'DATA_ISSUES', 409);
  const themes = snap.themes.map(t => ({ ...t })), assignments = snap.assignments.map(a => ({ ...a })), writes = [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const stamp = now.toISOString();
  const allocate = name => {
    const boolCols = name === 'Temas' ? [3, 4, 5, 6] : [4, 5, 12];
    const index = snap.rows[name].findIndex((r, i) => i > 0 && M.placeholder(r, boolCols) && !writes.some(w => w.name === name && w.rowIdx === i + 1));
    if (index < 0) M.fail('La plantilla está llena. Amplía solo la pestaña de repertorio antes de continuar.', 'CAPACITY', 409);
    return index + 1;
  };
  function put(name, before, after) {
    const clean = name === 'Temas' ? cleanTheme : cleanAssignment;
    if (before && JSON.stringify(clean(before)) === JSON.stringify(clean(after))) return;
    const rowIdx = before?.rowIdx || allocate(name);
    after.rowIdx = rowIdx;
    if (name === 'GrupoTemas') after.actualizadoEn = stamp;
    writes.push({ name, rowIdx, after });
  }
  const findAssignment = id => { const a = assignments.find(a => a.id === id); if (!a) M.fail('Relación no encontrada.', 'NOT_FOUND', 404); return a; };
  if (p.action === 'saveTheme') {
    const t = M.theme(p.theme), before = themes.find(a => a.id === t.id);
    put('Temas', before, t);
    if (before) Object.assign(before, t); else themes.push(t);
  } else if (p.action === 'archiveTheme') {
    const t = themes.find(t => t.id === p.temaId); if (!t) M.fail('Tema no encontrado.', 'NOT_FOUND', 404);
    const after = { ...t, activo: p.activo }; M.theme(cleanTheme(after)); put('Temas', t, after); Object.assign(t, after);
  } else if (p.action === 'assignThemes') {
    const grupo = M.group(snap.groups, p.grupo);
    for (const input of p.assignments) {
      const t = themes.find(t => t.id === input.temaId);
      if (!t?.activo) M.fail('Solo se pueden asignar temas activos.');
      const existing = assignments.find(a => M.assignmentKey(a) === M.assignmentKey({ grupo, temaId: t.id }));
      if (assignments.some(a => a.id === input.id && a !== existing)) M.fail('UUID de relación ya utilizado.', 'ID_CONFLICT', 409);
      if (existing) { const after = { ...existing, activo: true }; put('GrupoTemas', existing, after); Object.assign(existing, after); }
      else {
        const a = M.assignment({ id: input.id, grupo, temaId: t.id, realizado: false, repasando: false, fechaRealizado: '', ultimoRepaso: '', proximoObjetivo: '', motivoRepaso: '', notas: '', actualizadoEn: '', activo: true });
        put('GrupoTemas', null, a); assignments.push(a);
      }
    }
  } else {
    const ids = p.ids || [p.vinculoId];
    for (const id of ids) {
      const before = findAssignment(id), after = { ...before };
      if (p.action !== 'archiveAssignment' && !before.activo) M.fail('Recupera la relación archivada antes de editarla.', 'ARCHIVED', 409);
      if (p.action === 'archiveAssignment') after.activo = p.activo;
      else if (p.action === 'updateProgress') {
        Object.assign(after, p.changes);
        if (p.changes.realizado === true && !before.realizado && !before.fechaRealizado && p.changes.fechaRealizado === undefined) after.fechaRealizado = today;
      } else if (p.action === 'recordRehearsal') after.ultimoRepaso = p.date || today;
      else if (p.action === 'markForReview') {
        after.repasando = true;
        for (const key of ['motivoRepaso', 'proximoObjetivo']) if (p[key] !== undefined) after[key] = p[key];
      }
      M.assignment(cleanAssignment(after));
      put('GrupoTemas', before, after); Object.assign(before, after);
    }
  }
  const issues = M.integrity(themes, assignments, snap.groups);
  if (issues.length) M.fail('El cambio crea un conflicto: ' + issues[0].code, issues[0].code, 409);
  return writes;
}
async function execute(payload, token, transport, now) {
  validatePayload(payload);
  const request = P.guardRequest(transport), snap = await snapshot(token, request);
  if (READ_ACTIONS.includes(payload.action)) {
    const out = response(snap);
    if (payload.action === 'catalog') {
      out.themes = out.themes.filter(t => payload.includeArchived || t.activo); delete out.assignments;
    } else if (payload.action === 'groupRepertoire') {
      const grupo = M.group(snap.groups, payload.grupo);
      out.assignments = out.assignments.filter(a => G.same(a.grupo, grupo) && (payload.includeArchived || (a.activo && snap.themes.find(t => t.id === a.temaId)?.activo)));
      out.summary = M.summary(out.assignments); out.grupo = grupo;
    }
    return out;
  }
  const writes = plan(payload, snap, now);
  if (!writes.length) return { ...response(snap), unchanged: true, rowsChanged: 0 };
  if (payload.expectedVersion !== snap.version) M.fail('Los datos cambiaron. Recarga antes de guardar.', 'REVIEW_EXPIRED', 409);
  const fresh = await snapshot(token, request);
  if (fresh.version !== snap.version) M.fail('Los datos cambiaron durante la revisión.', 'REVIEW_EXPIRED', 409);
  const requests = writes.map(w => {
    const values = w.name === 'Temas' ? themeCells(w.after) : assignmentCells(w.after, w.rowIdx);
    return { updateCells: { range: { sheetId: snap.sheets[w.name].sheetId, startRowIndex: w.rowIdx - 1, endRowIndex: w.rowIdx, startColumnIndex: 0, endColumnIndex: values.length }, rows: [{ values }], fields: 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation' } };
  });
  try {
    await request(P.BASE + ':batchUpdate', token, 'POST', { requests });
    const after = await snapshot(token, request);
    if (after.issues.length) throw Error('El estado guardado tiene incidencias.');
    for (const w of writes) {
      const found = (w.name === 'Temas' ? after.themes : after.assignments).find(a => a.id === w.after.id);
      const clean = w.name === 'Temas' ? cleanTheme : cleanAssignment;
      if (!found || JSON.stringify(clean(found)) !== JSON.stringify(clean(w.after))) throw Error('La relectura no coincide.');
      if (w.name === 'GrupoTemas') {
        const cell = after.rows.GrupoTemas[found.rowIdx - 1][3];
        if (cell.userEnteredValue?.formulaValue !== lookupFormula(found.rowIdx) || cell.effectiveValue?.errorValue || M.value({ effectiveValue: cell.effectiveValue }) !== after.themes.find(t => t.id === found.temaId)?.nombre) throw Error('No se pudo verificar NombreTema.');
      }
    }
    return { ...response(after), rowsChanged: writes.length };
  } catch (error) { M.fail('Guardado pendiente de comprobar. Consulta validate antes de reintentar. ' + error.message, 'WRITE_UNCERTAIN', 503); }
}
// Serializes writes within this process. It is not a distributed lock against Sheets editors.
let pending = Promise.resolve();
function runRepertoire(payload, token, transport, now = new Date()) {
  try { validatePayload(payload); } catch (error) { return Promise.reject(error); }
  if (READ_ACTIONS.includes(payload.action)) return execute(payload, token, transport, now);
  const job = pending.then(() => execute(payload, token, transport, now));
  pending = job.catch(() => {});
  return job;
}
module.exports = { READ_ACTIONS, validatePayload, snapshot, plan, runRepertoire, themeCells, assignmentCells, lookupFormula };
