'use strict';
const { createHash } = require('node:crypto');
const M = require('../repertoire-model.js'), S = require('./repertoire-service.cjs');
const config = require('../projects/repertorio/rehearsal.json');
const SOURCE = '1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k';
const DESTINATION = '1MTNHpssZNYicFxc_vtlV16Insdk5m4NSd7_DRHhjUXI';
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
const FIELDS = 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation';
const names = ['Temas', 'GrupoTemas', 'Coles'];
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
const hash = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const theme = t => Object.fromEntries(M.THEME_FIELDS.map(k => [k, t[k]]));
const assignment = a => Object.fromEntries(M.ASSIGNMENT_FIELDS.map(k => [k, a[k]]));
const beforeCell = c => ({ ...(c.userEnteredValue ? { userEnteredValue: c.userEnteredValue } : {}), ...(c.userEnteredFormat?.numberFormat ? { userEnteredFormat: { numberFormat: c.userEnteredFormat.numberFormat } } : {}), ...(c.dataValidation ? { dataValidation: c.dataValidation } : {}) });
function configured() { if (config.sourceSpreadsheetId !== SOURCE || config.destinationSpreadsheetId !== DESTINATION || SOURCE === DESTINATION || config.productionAllowed !== false) M.fail('El manifiesto de ensayo no coincide con los destinos fijados.', 'FORBIDDEN_TARGET', 403); }
function scoped(request, destinationIds) {
  configured();
  return async (url, token, method = 'GET', body) => {
    const u = new URL(url), id = u.pathname.split('/')[3];
    if (u.origin !== 'https://sheets.googleapis.com' || u.username || u.password || u.hash || ![SOURCE, DESTINATION].includes(id?.replace(':batchUpdate', ''))) M.fail('El migrador solo accede a las dos copias del ensayo.', 'FORBIDDEN_TARGET', 403);
    if (method === 'GET' && u.pathname === '/v4/spreadsheets/' + id && [SOURCE, DESTINATION].includes(id)) {
      const ranges = u.searchParams.getAll('ranges'), grid = u.searchParams.get('includeGridData') === 'true';
      const allowedFields = grid ? 'spreadsheetId,sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,userEnteredFormat(numberFormat),dataValidation))))' : 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties))';
      if ([...u.searchParams.keys()].some(k => !['fields', 'includeGridData', 'ranges'].includes(k)) || u.searchParams.get('fields') !== allowedFields || (grid && ranges.length !== 3) || ranges.some(r => !/^(Temas!A1:H|GrupoTemas!A1:M|Coles!A1:A)[1-9]\d{0,4}$/.test(r) || +r.match(/\d+$/)[0] > 10000)) M.fail('Lectura de migración fuera de repertorio.', 'FORBIDDEN_RANGE', 403);
    } else if (method === 'POST' && u.href === API + DESTINATION + ':batchUpdate') {
      if (!destinationIds || !body || Object.keys(body).some(k => k !== 'requests') || !Array.isArray(body.requests) || !body.requests.length || body.requests.length > 50) M.fail('Lote de migración bloqueado.', 'FORBIDDEN_WRITE', 403);
      for (const item of body.requests) {
        const w = item.updateCells, r = w?.range, name = Object.keys(destinationIds).find(n => destinationIds[n] === r?.sheetId), width = M.HEADERS[name]?.length;
        if (Object.keys(item).length !== 1 || !width || !w || [0, 758405382, 1532527911, 359152999, 1391231953, 901061693].includes(r.sheetId) || w.fields !== FIELDS || Object.keys(w).some(k => !['range', 'rows', 'fields'].includes(k)) || Object.keys(r).some(k => !['sheetId', 'startRowIndex', 'endRowIndex', 'startColumnIndex', 'endColumnIndex'].includes(k)) || !Number.isInteger(r.startRowIndex) || r.startRowIndex < 1 || r.endRowIndex !== r.startRowIndex + 1 || r.endRowIndex > 10000 || r.startColumnIndex !== 0 || r.endColumnIndex !== width || w.rows?.length !== 1 || w.rows[0].values?.length !== width) M.fail('Escritura de migración fuera de las pestañas nuevas.', 'FORBIDDEN_WRITE', 403);
      }
    } else M.fail('Operación de migración bloqueada.', 'FORBIDDEN_WRITE', 403);
    return request(url, token, method, body);
  };
}
async function read(id, request, token) {
  const safe = scoped(request), q = new URLSearchParams({ fields: 'spreadsheetId,properties(locale,timeZone),sheets(properties(sheetId,title,gridProperties))' });
  const meta = await safe(API + id + '?' + q, token);
  if (meta.spreadsheetId !== id || meta.properties?.locale !== 'es_ES' || meta.properties?.timeZone !== 'Europe/Madrid') M.fail('Libro de ensayo no reconocido.', 'SCHEMA_MISMATCH', 409);
  const specs = {};
  for (const name of names) {
    const found = meta.sheets?.filter(s => s.properties.title === name) || [], p = found[0]?.properties;
    if (found.length !== 1 || !p || !Number.isInteger(p.gridProperties?.rowCount) || p.gridProperties.rowCount < 2 || p.gridProperties.rowCount > 10000 || p.gridProperties.columnCount < (M.HEADERS[name]?.length || 1)) M.fail('Inicializa y revisa las pestañas del ensayo: ' + name, 'SCHEMA_MISMATCH', 409);
    // Never accept an old tab masquerading as a new repertoire tab in a copied workbook.
    if (name !== 'Coles' && [0, 758405382, 1532527911, 359152999, 1391231953, 901061693].includes(p.sheetId)) M.fail('Identificador de pestaña heredada bloqueado.', 'FORBIDDEN_WRITE', 403);
    specs[name] = p;
  }
  const gridQuery = new URLSearchParams({ includeGridData: 'true', fields: 'spreadsheetId,sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,userEnteredFormat(numberFormat),dataValidation))))' });
  for (const name of names) gridQuery.append('ranges', `${name}!A1:${name === 'Temas' ? 'H' : name === 'GrupoTemas' ? 'M' : 'A'}${specs[name].gridProperties.rowCount}`);
  const grid = await safe(API + id + '?' + gridQuery, token);
  if (grid.spreadsheetId !== id) M.fail('Respuesta de otro libro.', 'FORBIDDEN_TARGET', 403);
  const rows = {};
  for (const name of names) {
    const sheet = grid.sheets?.find(s => s.properties.title === name && s.properties.sheetId === specs[name].sheetId);
    if (!sheet) M.fail('Faltan datos de ' + name, 'SCHEMA_MISMATCH', 409);
    const width = M.HEADERS[name]?.length || 1;
    rows[name] = Array.from({ length: specs[name].gridProperties.rowCount }, () => Array.from({ length: width }, () => ({})));
    for (const block of sheet.data || []) {
      if (block.startColumn) M.fail('Bloque no reconocido.', 'SCHEMA_MISMATCH', 409);
      for (const [i, row] of (block.rowData || []).entries()) {
        const n = (block.startRow || 0) + i;
        if (n >= rows[name].length) M.fail('Datos fuera de rango.', 'SCHEMA_MISMATCH', 409);
        rows[name][n] = Array.from({ length: width }, (_, c) => row.values?.[c] || {});
      }
    }
  }
  if (M.value(rows.Coles[0][0]) !== 'Grupo') M.fail('Cabecera de grupos desconocida.', 'SCHEMA_MISMATCH', 409);
  const groups = rows.Coles.slice(1).map(r => M.value(r[0])).filter(g => typeof g === 'string' && g.trim());
  const parsed = M.fromCells(rows), issues = [...parsed.issues, ...M.integrity(parsed.themes, parsed.assignments, groups)];
  const fingerprint = hash({ specs: Object.fromEntries(names.map(n => [n, specs[n]])), rows: Object.fromEntries(names.map(n => [n, rows[n].map(r => r.map(c => ({ v: c.userEnteredValue || {}, f: c.userEnteredFormat?.numberFormat || null, d: c.dataValidation || null })))])) });
  return { id, specs, rows, groups, ...parsed, issues, fingerprint };
}
function build(source, destination, { allowDemo = false } = {}) {
  configured();
  if (source.id !== SOURCE || destination.id !== DESTINATION) M.fail('Los destinos del plan no están autorizados.', 'FORBIDDEN_TARGET', 403);
  if (source.issues.length || destination.issues.length) M.fail('Hay incidencias sin resolver. No se prepara una migración.', 'DATA_ISSUES', 409);
  if (!allowDemo && source.themes.some(t => /\bDEMO\b|SIMULACI[ÓO]N/i.test(t.nombre))) M.fail('Hay datos DEMO. Excluirlos o limitar el ensayo explícitamente.', 'DEMO_DATA', 409);
  const writes = [], themes = destination.themes.map(theme), assignments = destination.assignments.map(assignment);
  const allocate = name => {
    const idx = destination.rows[name].findIndex((r, i) => i && M.placeholder(r, name === 'Temas' ? [3, 4, 5, 6] : [4, 5, 12]) && !writes.some(w => w.name === name && w.rowIdx === i + 1));
    if (idx < 0) M.fail('Capacidad insuficiente en ' + name, 'CAPACITY', 409);
    return idx + 1;
  };
  for (const t of source.themes.map(theme)) {
    const previous = themes.find(x => x.id === t.id);
    if (previous && hash(previous) !== hash(t)) M.fail('El destino tiene un tema distinto con el mismo ID.', 'DESTINATION_CONFLICT', 409);
    if (!previous) { writes.push({ name: 'Temas', rowIdx: allocate('Temas'), data: t }); themes.push(t); }
  }
  for (const original of source.assignments.map(assignment)) {
    const a = { ...original, grupo: M.group(destination.groups, original.grupo) }, previous = assignments.find(x => x.id === a.id);
    if (previous && hash(previous) !== hash(a)) M.fail('El destino tiene seguimiento distinto para el mismo ID.', 'DESTINATION_CONFLICT', 409);
    if (assignments.some(x => M.assignmentKey(x) === M.assignmentKey(a) && x.id !== a.id)) M.fail('La relación ya existe con otro ID.', 'DUPLICATE_ASSIGNMENT', 409);
    if (!previous) { writes.push({ name: 'GrupoTemas', rowIdx: allocate('GrupoTemas'), data: a }); assignments.push(a); }
  }
  const issues = M.integrity(themes, assignments, destination.groups);
  if (issues.length) M.fail('La unión no es válida: ' + issues[0].code, issues[0].code, 409);
  const plan = { kind: 'repertoire-rehearsal-v1', sourceId: SOURCE, destinationId: DESTINATION, allowDemo, sourceFingerprint: source.fingerprint, destinationFingerprint: destination.fingerprint,
    counts: { sourceThemes: source.themes.length, sourceAssignments: source.assignments.length, themesToInsert: writes.filter(w => w.name === 'Temas').length, assignmentsToInsert: writes.filter(w => w.name === 'GrupoTemas').length },
    writes: writes.map(w => ({ ...w, sheetId: destination.specs[w.name].sheetId, before: destination.rows[w.name][w.rowIdx - 1].map(beforeCell) })) };
  return { ...plan, digest: hash(plan) };
}
async function prepare(request, token, options) { const source = await read(SOURCE, request, token), destination = await read(DESTINATION, request, token); return build(source, destination, options); }
function requestFor(w, restore = false) { const values = restore ? w.before : w.name === 'Temas' ? S.themeCells(w.data) : S.assignmentCells(w.data, w.rowIdx); return { updateCells: { range: { sheetId: w.sheetId, startRowIndex: w.rowIdx - 1, endRowIndex: w.rowIdx, startColumnIndex: 0, endColumnIndex: M.HEADERS[w.name].length }, rows: [{ values }], fields: FIELDS } }; }
function checkArtifact(artifact, kind) { if (!artifact || artifact.kind !== kind) M.fail('Tipo de plan o recibo incorrecto.', 'INVALID_PLAN', 409); const { digest, ...body } = artifact; if (digest !== hash(body) || artifact.sourceId !== SOURCE || artifact.destinationId !== DESTINATION) M.fail('Plan o recibo alterado.', 'INVALID_PLAN', 409); }
async function verify(plan, request, token) {
  const snapshot = await read(DESTINATION, request, token);
  if (snapshot.issues.length) M.fail('La verificación detectó incidencias.', 'VERIFY_FAILED', 503);
  for (const w of plan.writes) {
    const found = (w.name === 'Temas' ? snapshot.themes : snapshot.assignments).find(x => x.id === w.data.id);
    if (!found || hash(w.name === 'Temas' ? theme(found) : assignment(found)) !== hash(w.data)) M.fail('Los datos migrados no coinciden.', 'VERIFY_FAILED', 503);
    if (w.name === 'GrupoTemas') {
      const c = snapshot.rows.GrupoTemas[found.rowIdx - 1][3];
      if (c.userEnteredValue?.formulaValue !== S.lookupFormula(found.rowIdx) || c.effectiveValue?.errorValue || c.effectiveValue?.stringValue !== snapshot.themes.find(t => t.id === w.data.temaId)?.nombre) M.fail('NombreTema no se calcula en el destino.', 'VERIFY_FAILED', 503);
    }
  }
  return snapshot;
}
async function apply(plan, request, token) {
  checkArtifact(plan, 'repertoire-rehearsal-v1');
  const fresh = await prepare(request, token, { allowDemo: plan.allowDemo });
  if (fresh.digest !== plan.digest) {
    if (!fresh.writes.length && fresh.sourceFingerprint === plan.sourceFingerprint) return { unchanged: true, rowsChanged: 0, destinationId: DESTINATION };
    M.fail('El origen o el destino cambió; genera y revisa otro dry-run.', 'REVIEW_EXPIRED', 409);
  }
  const dest = await read(DESTINATION, request, token), ids = { Temas: dest.specs.Temas.sheetId, GrupoTemas: dest.specs.GrupoTemas.sheetId }, safe = scoped(request, ids);
  if (dest.fingerprint !== plan.destinationFingerprint) M.fail('El destino cambió antes de aplicar.', 'REVIEW_EXPIRED', 409);
  // API batches are limited. Partial outcomes require a new dry-run, never an automatic replay.
  for (let i = 0; i < plan.writes.length; i += 50) await safe(API + DESTINATION + ':batchUpdate', token, 'POST', { requests: plan.writes.slice(i, i + 50).map(w => requestFor(w)) });
  const after = await verify(plan, request, token);
  const receipt = { kind: 'repertoire-rehearsal-receipt-v1', sourceId: SOURCE, destinationId: DESTINATION, sourceFingerprint: plan.sourceFingerprint, beforeFingerprint: plan.destinationFingerprint, afterFingerprint: after.fingerprint, writes: plan.writes };
  return { rowsChanged: plan.writes.length, receipt: { ...receipt, digest: hash(receipt) } };
}
async function rollback(receipt, request, token) {
  checkArtifact(receipt, 'repertoire-rehearsal-receipt-v1');
  const dest = await read(DESTINATION, request, token);
  if (dest.fingerprint === receipt.beforeFingerprint) return { unchanged: true, restored: true };
  if (dest.fingerprint !== receipt.afterFingerprint) M.fail('El destino tiene cambios posteriores. No se sobrescriben.', 'REVIEW_EXPIRED', 409);
  const safe = scoped(request, { Temas: dest.specs.Temas.sheetId, GrupoTemas: dest.specs.GrupoTemas.sheetId });
  for (let i = 0; i < receipt.writes.length; i += 50) await safe(API + DESTINATION + ':batchUpdate', token, 'POST', { requests: receipt.writes.slice(i, i + 50).reverse().map(w => requestFor(w, true)) });
  const after = await read(DESTINATION, request, token);
  if (after.fingerprint !== receipt.beforeFingerprint) M.fail('No se pudo verificar la recuperación.', 'VERIFY_FAILED', 503);
  return { restored: true, destinationId: DESTINATION };
}
if (require.main === module) console.log(JSON.stringify({ mode: 'dry-run', sourceId: SOURCE, destinationId: DESTINATION, writesExecuted: false, usage: 'Use prepare(request, token) or the authenticated connector bridge. No production target is supported.' }));
module.exports = { SOURCE, DESTINATION, hash, read, build, prepare, apply, rollback, scoped, requestFor };
