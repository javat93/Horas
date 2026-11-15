'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../repertoire-client.js');
const { fixture, theme } = require('./fixtures/repertoire.cjs');
test('el cliente confirma destino y capacidades antes de habilitar la interfaz', () => {
  const good = { mode: 'repertoire-development', spreadsheetId: C.TARGET, calendarAccess: false, legacyOperationsEnabled: false, writeEnabled: true, writableSheets: ['Temas', 'GrupoTemas'] };
  assert.equal(C.verifyEnvironment(good), good);
  for (const changes of [{ spreadsheetId: 'original' }, { calendarAccess: true }, { legacyOperationsEnabled: true }, { writableSheets: ['Detalle'] }, { mode: 'production' }]) assert.throws(() => C.verifyEnvironment({ ...good, ...changes }));
});
test('cada guardado utiliza la versión confirmada y una respuesta no verificada no sustituye datos', async () => {
  const f = fixture(), requests = []; let bad = false;
  const client = C.create({ writeEnabled: true, transport: async p => { requests.push(p); const d = await f.run(p); return bad ? { ...d, spreadsheetId: 'original' } : d; } });
  await client.load(); const version = client.state().data.version;
  await client.save({ action: 'saveTheme', theme: theme() }); assert.equal(requests[1].expectedVersion, version);
  const old = client.state().data; bad = true;
  await assert.rejects(client.save({ action: 'saveTheme', theme: theme(2) }), { code: 'UNVERIFIED_RESPONSE' });
  assert.equal(client.state().data, old); assert.equal(client.state().needsReload, true); assert.equal(client.state().canWrite, false);
});
test('exclusión de dobles envíos y estados de carga; no hay reintentos automáticos', async () => {
  const f = fixture(); let finish, calls = 0;
  const client = C.create({ writeEnabled: true, transport: p => { calls++; if (p.action === 'validate') return f.run(p); return new Promise(resolve => { finish = () => f.run(p).then(resolve); }); } });
  await client.load(); const first = client.save({ action: 'saveTheme', theme: theme() });
  assert.equal(client.state().busy, true); await assert.rejects(client.save({ action: 'saveTheme', theme: theme(2) })); assert.equal(calls, 2);
  await finish(); await first; assert.equal(client.state().busy, false);
});
for (const code of ['REVIEW_EXPIRED', 'WRITE_UNCERTAIN', 'DATA_ISSUES']) test(`el cliente bloquea nuevos cambios tras ${code} hasta una lectura explícita`, async () => {
  const f = fixture(); let fail = true, calls = 0;
  const client = C.create({ writeEnabled: true, transport: p => { calls++; if (p.action !== 'validate' && fail) throw Object.assign(Error(code), { code, status: code === 'WRITE_UNCERTAIN' ? 503 : 409 }); return f.run(p); } });
  await client.load(); await assert.rejects(client.save({ action: 'saveTheme', theme: theme() }));
  assert.equal(client.state().needsReload, true); const count = calls;
  await assert.rejects(client.save({ action: 'saveTheme', theme: theme() })); assert.equal(calls, count);
  fail = false; await client.load(); await client.save({ action: 'saveTheme', theme: theme() }); assert.equal(client.state().data.themes.length, 1);
});
test('un conflicto de orden conserva la versión y permite corregir el formulario sin recargar', async () => {
  const f = fixture(); await f.apply({ action: 'saveTheme', theme: theme() });
  const client = C.create({ writeEnabled: true, transport: f.run }); await client.load();
  await assert.rejects(client.save({ action: 'saveTheme', theme: theme(2, { numeroOrden: 1 }) }), { code: 'ORDER_CONFLICT' });
  assert.equal(client.state().needsReload, false); assert.equal(client.state().canWrite, true);
  await client.save({ action: 'saveTheme', theme: theme(2) });
});
test('solo lectura e incidencias bloquean cambios sin enviar una petición de escritura', async () => {
  const f = fixture(); let writes = 0;
  for (const writeEnabled of [false, true]) {
    const client = C.create({ writeEnabled, transport: async p => { if (p.action !== 'validate') writes++; const d = await f.run(p); return writeEnabled ? { ...d, issues: [{ code: 'IMPORT_CANDIDATE' }] } : d; } });
    await client.load(); await assert.rejects(client.save({ action: 'saveTheme', theme: theme() }));
  }
  assert.equal(writes, 0);
});
test('la sesión de la interfaz puede vaciar sus datos sin modificar la hoja', async () => {
  const f = fixture(), client = C.create({ transport: f.run }); await client.load(); client.clear(); assert.equal(client.state().data, null); assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
});
test('rutas de simulación ausentes del servidor conectado a la copia', async t => {
  const { createServer } = require('./repertoire-server.cjs'); const f = fixture(); const server = createServer({ request: f.request, writeEnabled: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/api/preview-session')).status, 404);
  assert.equal((await fetch(base + '/api/preview-control', { method: 'POST', body: '{}' })).status, 404);
  for (const asset of ['repertoire.css', 'repertoire-ui.js', 'repertoire-client.js', 'repertoire-model.js']) assert.equal((await fetch(base + '/assets/' + asset)).status, 200);
  assert.equal((await fetch(base + '/assets/../api/production.js')).status, 404);
});
