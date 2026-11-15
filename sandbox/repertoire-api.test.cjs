'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../api/repertorio-test.js');
const { createServer } = require('./repertoire-server.cjs');
const P = require('./repertoire-policy.cjs');
const { fixture, theme } = require('./fixtures/repertoire.cjs');
async function call(handler, { method = 'POST', body = { action: 'catalog' }, query = {}, origin = 'http://localhost:3002', authorization = 'Bearer simulated' } = {}) {
  const result = { headers: {}, code: 200 };
  const res = { setHeader: (k, v) => { result.headers[k] = v; }, status: n => { result.code = n; return res; }, json: data => { result.body = data; }, end: () => {} };
  await handler({ method, body, query, headers: { origin, authorization } }, res); return result;
}
test('environment y oauth identifican solo desarrollo y no solicitan Calendar', async () => {
  let calls = 0; const h = createHandler({ request: async () => { calls++; } });
  const env = await call(h, { method: 'GET', query: { api: 'environment' } });
  assert.equal(env.body.spreadsheetId, P.DEVELOPMENT_ID); assert.equal(env.body.writeEnabled, false); assert.equal(env.body.calendarAccess, false); assert.equal(env.body.legacyOperationsEnabled, false);
  const oauth = await call(h, { method: 'GET', query: { api: 'oauth' } }); assert(!oauth.body.scopes.includes('calendar')); assert.equal(calls, 0);
});
for (const [name, options, status] of [
  ['origen ajeno', { origin: 'https://evil.invalid' }, 403],
  ['sin autenticación', { authorization: '' }, 401],
  ['original como destino', { body: { action: 'catalog', spreadsheetId: '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60' } }, 403],
  ['sesiones', { body: { action: 'daily' } }, 400],
  ['Calendar', { body: { action: 'deleteEvent' } }, 400],
  ['rango arbitrario', { body: { action: 'catalog', range: 'Detalle!A1' } }, 400],
  ['consulta legacy', { query: { api: 'daily' } }, 405],
  ['método DELETE', { method: 'DELETE' }, 405]
]) test(`endpoint rechaza ${name} antes de llamar a Google`, async () => {
  let calls = 0; const h = createHandler({ writeEnabled: true, request: async () => { calls++; } });
  assert.equal((await call(h, options)).code, status); assert.equal(calls, 0);
});
test('API en solo lectura permite consultar y rechaza guardar', async () => {
  const f = fixture(), h = createHandler({ request: f.request });
  const c = await call(h); assert.equal(c.code, 200);
  const r = await call(h, { body: { action: 'saveTheme', theme: theme(), expectedVersion: c.body.version } });
  assert.equal(r.code, 403); assert.equal(r.body.code, 'READ_ONLY');
});
test('API conserva códigos de conflicto y permite un ciclo autenticado simulado', async () => {
  const f = fixture(), h = createHandler({ request: f.request, writeEnabled: true });
  const c = await call(h), b = { action: 'saveTheme', theme: theme(), expectedVersion: c.body.version };
  assert.equal((await call(h, { body: b })).code, 200);
  assert.equal((await call(h, { body: { ...b, theme: theme(2) } })).code, 409);
});
test('servidor local no sirve la app productiva, otros endpoints, archivos o destinos', async t => {
  const f = fixture(), server = createServer({ request: f.request, writeEnabled: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const page = await (await fetch(base)).text(); assert(page.includes('DESARROLLO')); assert(!page.includes('config.production.js')); assert(!/localStorage\s*[.[]/.test(page));
  for (const route of ['/api/production', '/api/test-daily', '/api/calendar', '/index.html', '/.git/config']) assert.equal((await fetch(base + route)).status, 404);
  assert.equal((await fetch(base + '/api/repertorio-test?api=environment', { headers: { Origin: 'https://evil.invalid' } })).status, 403);
  const req = await fetch(base + '/api/repertorio-test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer simulated' }, body: JSON.stringify({ action: 'validate' }) });
  assert.equal(req.status, 200); assert.equal((await req.json()).spreadsheetId, P.DEVELOPMENT_ID);
  assert.equal((await fetch(base + '/api/repertorio-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
});
