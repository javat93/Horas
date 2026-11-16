'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../repertoire-model.js');
const S = require('./repertoire-service.cjs');
const P = require('./repertoire-policy.cjs');
const { fixture, id, theme } = require('./fixtures/repertoire.cjs');

test('plantillas con FALSE no son registros; una fila parcial se informa y bloquea escrituras', async () => {
  const f = fixture(); assert.equal((await f.read()).themes.length, 0);
  f.book.sheets[0].data[0].rowData[1].values[1] = { userEnteredValue: { stringValue: 'Sin ID' } };
  const data = await f.read(); assert.equal(data.issues[0].code, 'IMPORT_CANDIDATE');
  await assert.rejects(f.apply({ action: 'saveTheme', theme: theme() }), { code: 'DATA_ISSUES' });
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
});
for (const [field, value] of [['numeroOrden', 1.5], ['numeroOrden', 0], ['numeroOrden', '1'], ['temaGaleta', 'TRUE'], ['temaSlap', 1], ['activo', null], ['nombre', ''], ['id', 'fila-2'], ['notas', 5]]) {
  test(`validación estricta de ${field}=${JSON.stringify(value)} antes de Google`, async () => {
    const f = fixture(); await assert.rejects(f.run({ action: 'saveTheme', theme: theme(1, { [field]: value }), expectedVersion: 'a'.repeat(64) })); assert.equal(f.calls.length, 0);
  });
}
test('Galeta 1, Slap 1 y Propio 1 conviven; compartir un tipo impide repetir orden', async () => {
  const f = fixture();
  await f.apply({ action: 'saveTheme', theme: theme() });
  await f.apply({ action: 'saveTheme', theme: theme(2, { numeroOrden: 1, temaGaleta: false, temaSlap: true }) });
  await f.apply({ action: 'saveTheme', theme: theme(3, { numeroOrden: 1, temaGaleta: false, temaPropio: true }) });
  await assert.rejects(f.apply({ action: 'saveTheme', theme: theme(4, { numeroOrden: 1, temaPropio: true }) }), { code: 'ORDER_CONFLICT' });
  assert.equal((await f.read()).themes.length, 3);
});
test('varios tipos, archivo y reactivación vuelven a validar ambas posiciones', async () => {
  const f = fixture(); await f.apply({ action: 'saveTheme', theme: theme(1, { temaPropio: true }) });
  await assert.rejects(f.apply({ action: 'saveTheme', theme: theme(2, { numeroOrden: 1, temaGaleta: false, temaPropio: true }) }), { code: 'ORDER_CONFLICT' });
  await f.apply({ action: 'archiveTheme', temaId: id(1), activo: false });
  await f.apply({ action: 'saveTheme', theme: theme(2, { numeroOrden: 1, temaGaleta: false, temaPropio: true }) });
  await assert.rejects(f.apply({ action: 'archiveTheme', temaId: id(1), activo: true }), { code: 'ORDER_CONFLICT' });
});
test('un borrador inactivo puede carecer de tipo; activarlo exige tipo', async () => {
  const f = fixture(); await f.apply({ action: 'saveTheme', theme: theme(1, { activo: false, temaGaleta: false }) });
  await assert.rejects(f.apply({ action: 'saveTheme', theme: theme(1, { temaGaleta: false }) }));
  await assert.rejects(f.apply({ action: 'archiveTheme', temaId: id(1), activo: true }));
  assert.equal((await f.read()).themes[0].activo, false);
});
test('NombreTema como fórmula vacía no convierte una fila de plantilla en registro', async () => {
  const f = fixture(); f.book.sheets[1].data[0].rowData[1].values[3] = { userEnteredValue: { formulaValue: S.lookupFormula(2) }, effectiveValue: { stringValue: '' } };
  assert.deepEqual((await f.read()).issues, []); await f.seed(); assert.equal((await f.read()).assignments.length, 1);
});
test('se conserva el nombre exacto de Coles con espacios históricos para la validación nativa', async () => {
  const f = fixture({ groups: ['Bernat Mogoda '] }); await f.seed();
  assert.equal((await f.read()).assignments[0].grupo, 'Bernat Mogoda ');
  assert.equal(f.book.sheets[1].data[0].rowData[1].values[1].userEnteredValue.stringValue, 'Bernat Mogoda ');
});
test('la barrera no admite datos de cuadrícula ocultos dentro de una petición de metadatos', async () => {
  let called = false;
  await assert.rejects(P.guardRequest(async () => { called = true; })(P.BASE + '?fields=sheets(data)', 'x'));
  assert.equal(called, false);
});
test('nuevas relaciones pendientes, independientes por grupo y deduplicadas al reintentar', async () => {
  const f = fixture(); const first = await f.seed();
  assert.equal(first.assignments[0].realizado, false); assert.equal(first.assignments[0].repasando, false);
  await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { realizado: true } });
  await f.apply({ action: 'assignThemes', grupo: 'Grupo B', assignments: [{ id: id(102), temaId: id(1) }] });
  await f.apply({ action: 'assignThemes', grupo: 'Grupo A', assignments: [{ id: id(103), temaId: id(1) }] });
  const data = await f.read(); assert.equal(data.assignments.length, 2); assert.equal(data.assignments[1].realizado, false); assert.equal(data.assignments[0].id, id(101));
});
test('Realizado y Repasando coexisten; el repaso se registra explícitamente y usa fecha de Madrid', async () => {
  const f = fixture(); await f.seed();
  await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { realizado: true } });
  let data = await f.apply({ action: 'markForReview', ids: [id(101)], motivoRepaso: 'Nuevas incorporaciones' });
  assert.equal(data.assignments[0].fechaRealizado, '2026-11-16'); assert.equal(data.assignments[0].ultimoRepaso, ''); assert.equal(data.assignments[0].realizado, true); assert.equal(data.assignments[0].repasando, true);
  data = await f.apply({ action: 'recordRehearsal', ids: [id(101)], date: '2026-11-15' });
  assert.equal(data.assignments[0].ultimoRepaso, '2026-11-15');
  data = await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { repasando: false } });
  assert.equal(data.assignments[0].realizado, true); assert.equal(data.assignments[0].ultimoRepaso, '2026-11-15');
});
test('recuperar una relación archivada conserva su UUID y el seguimiento', async () => {
  const f = fixture(); await f.seed(); await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { realizado: true, notas: 'Conservar' } });
  await f.apply({ action: 'archiveAssignment', vinculoId: id(101), activo: false });
  assert.equal((await f.run({ action: 'groupRepertoire', grupo: 'Grupo A' })).assignments.length, 0);
  const data = await f.apply({ action: 'assignThemes', grupo: 'Grupo A', assignments: [{ id: id(102), temaId: id(1) }] });
  assert.equal(data.assignments.length, 1); assert.equal(data.assignments[0].id, id(101)); assert.equal(data.assignments[0].notas, 'Conservar');
});
test('alias conocidos resuelven el grupo; alias duplicados y grupos inexistentes no se escriben', async () => {
  const f = fixture(); await f.apply({ action: 'saveTheme', theme: theme() });
  const data = await f.apply({ action: 'assignThemes', grupo: 'Tramuntana', assignments: [{ id: id(101), temaId: id(1) }] });
  assert.equal(data.assignments[0].grupo, 'Moli de finestrelles');
  await assert.rejects(f.apply({ action: 'assignThemes', grupo: 'No existe', assignments: [{ id: id(102), temaId: id(1) }] }), { code: 'INVALID_GROUP' });
  assert.equal(M.integrity([], [], ['Moli de finestrelles', 'Tramuntana'])[0].code, 'AMBIGUOUS_GROUP');
});
test('edición externa y reordenación de filas conservan vínculos y detectan versión antigua', async () => {
  const f = fixture(); await f.seed(); const before = await f.read();
  const rows = f.book.sheets[1].data[0].rowData; [rows[1], rows[5]] = [rows[5], rows[1]];
  await assert.rejects(f.run({ action: 'updateProgress', vinculoId: id(101), changes: { notas: 'Antigua' }, expectedVersion: before.version }), { code: 'REVIEW_EXPIRED' });
  const data = await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { notas: 'Nueva' } });
  assert.equal(data.assignments[0].notas, 'Nueva'); assert.equal(rows[5].values[3].userEnteredValue.formulaValue, S.lookupFormula(6));
});
test('una edición entre la lectura y la última comprobación aborta antes de escribir', async () => {
  const f = fixture(); await f.seed(); const before = await f.read(); let reads = 0;
  f.onRead = () => { if (new URL(f.calls.at(-1).url).searchParams.get('includeGridData') === 'true' && ++reads === 2) f.book.sheets[0].data[0].rowData[1].values[7] = { userEnteredValue: { stringValue: 'Externo' } }; };
  const count = f.calls.filter(c => c.method === 'POST').length;
  await assert.rejects(f.run({ action: 'updateProgress', vinculoId: id(101), changes: { realizado: true }, expectedVersion: before.version }), { code: 'REVIEW_EXPIRED' });
  assert.equal(f.calls.filter(c => c.method === 'POST').length, count);
});
test('respuesta perdida después de guardar: reintentar el mismo UUID no duplica', async () => {
  const f = fixture(); const version = (await f.read()).version; const p = { action: 'saveTheme', theme: theme(), expectedVersion: version };
  f.failAfterWrite = true; await assert.rejects(f.run(p), { code: 'WRITE_UNCERTAIN' }); f.failAfterWrite = false;
  const data = await f.run(p); assert.equal(data.unchanged, true); assert.equal(data.themes.length, 1);
});
test('guardados concurrentes de este proceso se serializan y el segundo detecta el cambio', async () => {
  const f = fixture(); const version = (await f.read()).version;
  const results = await Promise.allSettled([f.run({ action: 'saveTheme', theme: theme(), expectedVersion: version }), f.run({ action: 'saveTheme', theme: theme(2), expectedVersion: version })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(results[1].reason.code, 'REVIEW_EXPIRED');
});
test('un lote con una relación inexistente no modifica ninguna otra', async () => {
  const f = fixture(); await f.seed(); const count = f.calls.filter(c => c.method === 'POST').length;
  await assert.rejects(f.apply({ action: 'markForReview', ids: [id(101), id(999)] }), { code: 'NOT_FOUND' }); assert.equal(f.calls.filter(c => c.method === 'POST').length, count);
});
test('notas potencialmente interpretables como fórmula se guardan como texto literal', async () => {
  const f = fixture(); await f.seed(); await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { notas: '=IMPORTXML("https://example.invalid";"x")' } });
  assert.deepEqual(f.book.sheets[1].data[0].rowData[1].values[10].userEnteredValue, { stringValue: '=IMPORTXML("https://example.invalid";"x")' });
});
test('fórmula NombreTema se verifica; un error de cálculo produce WRITE_UNCERTAIN', async () => {
  const f = fixture(); await f.seed(); f.afterWrite = () => { f.book.sheets[1].data[0].rowData[1].values[3].effectiveValue = { errorValue: { type: 'ERROR' } }; };
  await assert.rejects(f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { repasando: true } }), { code: 'WRITE_UNCERTAIN' });
});
test('todos los escritos se limitan a Temas y GrupoTemas; nunca se leen datos de Detalle', async () => {
  const f = fixture(); await f.seed(); await f.apply({ action: 'recordRehearsal', ids: [id(101)] });
  for (const c of f.calls) {
    assert(c.url.startsWith(P.BASE)); assert(!c.url.includes('calendar'));
    if (c.method === 'GET') assert(!new URL(c.url).searchParams.getAll('ranges').some(r => r.startsWith('Detalle')));
    else for (const r of c.body.requests) assert([142601101, 142601102].includes(r.updateCells.range.sheetId));
  }
});
for (const forbidden of ['https://sheets.googleapis.com/v4/spreadsheets/1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60', 'https://www.googleapis.com/calendar/v3/calendars/primary/events', P.BASE + '?includeGridData=true&ranges=Detalle!A1:N2', P.BASE + '?includeGridData=true']) {
  test('barrera remota rechaza ' + forbidden, async () => {
    let calls = 0; await assert.rejects(P.guardRequest(async () => { calls++; })(forbidden, 'x')); assert.equal(calls, 0);
  });
}
for (const sheetId of [0, 758405382, 1532527911]) test('barrera rechaza escritura en sheetId ' + sheetId, async () => {
  let calls = 0; const request = S.themeCells(theme());
  await assert.rejects(P.guardRequest(async () => { calls++; })(P.BASE + ':batchUpdate', 'x', 'POST', { requests: [{ updateCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 }, rows: [{ values: request }], fields: 'userEnteredValue,userEnteredFormat.numberFormat,dataValidation' } }] })); assert.equal(calls, 0);
});
test('esquema incorrecto o pestaña sustituida detienen el módulo', async () => {
  const f = fixture(); f.book.sheets[0].properties.sheetId = 0; await assert.rejects(f.read(), { code: 'SCHEMA_MISMATCH' });
});
test('fechas inválidas y campos de alumnos, rangos o perfiles son rechazados', async () => {
  const f = fixture();
  for (const p of [{ action: 'catalog', range: 'Detalle!A1' }, { action: 'catalog', profile: 'production' }, { action: 'catalog', alumnos: [] }, { action: 'updateProgress', vinculoId: id(101), changes: { ultimoRepaso: '2026-02-30' }, expectedVersion: 'a'.repeat(64) }]) await assert.rejects(f.run(p));
  assert.equal(f.calls.length, 0);
});
