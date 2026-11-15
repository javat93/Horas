'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const X = require('./repertoire-migration.cjs');
const S = require('./repertoire-service.cjs');
const { fixture, theme, id } = require('./fixtures/repertoire.cjs');
async function pair({ seed = true } = {}) {
  const source = fixture(), destination = fixture(); destination.book.spreadsheetId = X.DESTINATION;
  if (seed) { await source.seed(); await source.apply({ action: 'updateProgress', vinculoId: id(101), changes: { realizado: true, repasando: true, ultimoRepaso: '2026-11-15', notas: 'Conservar' } }); }
  const calls = [], request = async (url, token, method = 'GET', body) => { calls.push({ url, method, body }); return (url.includes(X.DESTINATION) ? destination : source).request(url, token, method, body); };
  return { source, destination, calls, request };
}
test('dry-run lee solo repertorio y grupos, conserva todas las fechas/estados y no escribe', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'simulated');
  assert.deepEqual(plan.counts, { sourceThemes: 1, sourceAssignments: 1, themesToInsert: 1, assignmentsToInsert: 1 });
  assert.equal(plan.writes[1].data.realizado, true); assert.equal(plan.writes[1].data.repasando, true); assert.equal(plan.writes[1].data.ultimoRepaso, '2026-11-15');
  assert(p.calls.every(c => c.method === 'GET')); assert(!p.calls.some(c => /Detalle|calendar/.test(c.url)));
});
test('aplicar, verificar, repetir sin duplicar y recuperar exactamente la plantilla previa', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'x');
  const applied = await X.apply(plan, p.request, 'x'); assert.equal(applied.rowsChanged, 2);
  const again = await X.prepare(p.request, 'x'); assert.equal(again.writes.length, 0);
  assert.equal((await X.apply(plan, p.request, 'x')).unchanged, true);
  const after = await X.read(X.DESTINATION, p.request, 'x'); assert.equal(after.assignments[0].notas, 'Conservar');
  assert.equal(after.rows.GrupoTemas[1][3].userEnteredValue.formulaValue, S.lookupFormula(2));
  assert.equal((await X.rollback(applied.receipt, p.request, 'x')).restored, true);
  assert.equal((await X.rollback(applied.receipt, p.request, 'x')).unchanged, true);
  const restored = await X.prepare(p.request, 'x'); assert.equal(restored.digest, plan.digest);
});
test('un cambio posterior bloquea el rollback y conserva el seguimiento nuevo', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'x'), applied = await X.apply(plan, p.request, 'x');
  p.destination.book.sheets[1].data[0].rowData[1].values[10].userEnteredValue = { stringValue: 'Cambio posterior' };
  await assert.rejects(X.rollback(applied.receipt, p.request, 'x'), { code: 'REVIEW_EXPIRED' });
  assert.equal(p.destination.book.sheets[1].data[0].rowData[1].values[10].userEnteredValue.stringValue, 'Cambio posterior');
});
test('datos distintos con el mismo ID nunca se sobrescriben', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'x'); await X.apply(plan, p.request, 'x');
  p.destination.book.sheets[0].data[0].rowData[1].values[1].userEnteredValue = { stringValue: 'Versión del destino' };
  await assert.rejects(X.prepare(p.request, 'x'), { code: 'DESTINATION_CONFLICT' });
});
test('edición del origen tras dry-run requiere un nuevo plan', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'x'); await p.source.apply({ action: 'saveTheme', theme: theme(2) });
  await assert.rejects(X.apply(plan, p.request, 'x'), { code: 'REVIEW_EXPIRED' }); assert.equal(p.calls.filter(c => c.method === 'POST').length, 0);
});
test('planes alterados y destinos originales se rechazan antes de cualquier llamada', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'x'), before = p.calls.length;
  await assert.rejects(X.apply({ ...plan, destinationId: 'original' }, p.request, 'x'), { code: 'INVALID_PLAN' });
  assert.equal(p.calls.length, before);
  await assert.rejects(X.scoped(p.request)('https://sheets.googleapis.com/v4/spreadsheets/1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60?fields=x', 'x'), { code: 'FORBIDDEN_TARGET' });
  assert.equal(p.calls.length, before);
});
test('datos DEMO se bloquean por defecto; solo el ensayo puede admitirlos explícitamente', async () => {
  const p = await pair({ seed: false }); await p.source.apply({ action: 'saveTheme', theme: theme(1, { nombre: 'DEMO temporal' }) });
  await assert.rejects(X.prepare(p.request, 'x'), { code: 'DEMO_DATA' });
  assert.equal((await X.prepare(p.request, 'x', { allowDemo: true })).writes.length, 1);
});
test('la barrera rechaza cabeceras, Coles, Detalle, creación/borrado de hojas y escritura en el origen', async () => {
  let count = 0; const guarded = X.scoped(async () => { count++; }, { Temas: 142601101, GrupoTemas: 142601102 });
  for (const sheetId of [0, 758405382, 901061693]) await assert.rejects(guarded('https://sheets.googleapis.com/v4/spreadsheets/' + X.DESTINATION + ':batchUpdate', 'x', 'POST', { requests: [{ updateCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 }, rows: [{ values: S.themeCells(theme()) }], fields: 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation' } }] }));
  for (const request of [{ deleteSheet: { sheetId: 0 } }, { addSheet: { properties: { title: 'Otra' } } }]) await assert.rejects(guarded('https://sheets.googleapis.com/v4/spreadsheets/' + X.DESTINATION + ':batchUpdate', 'x', 'POST', { requests: [request] }));
  await assert.rejects(guarded('https://sheets.googleapis.com/v4/spreadsheets/' + X.SOURCE + ':batchUpdate', 'x', 'POST', { requests: [] })); assert.equal(count, 0);
});
test('un error parcial admite un nuevo dry-run y reanudación por ID', async () => {
  const p = await pair(), plan = await X.prepare(p.request, 'x'); let failed = false;
  const request = async (...args) => { const result = await p.request(...args); if (args[2] === 'POST' && !failed) { failed = true; throw Error('Respuesta perdida'); } return result; };
  await assert.rejects(X.apply(plan, request, 'x'));
  const fresh = await X.prepare(p.request, 'x'); assert.equal(fresh.writes.length, 0); assert.equal((await X.apply(fresh, p.request, 'x')).rowsChanged, 0);
});
