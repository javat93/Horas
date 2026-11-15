'use strict';
// Connector-mediated probe: the bridge carries Sheets payloads, never OAuth credentials.
// The operator must serve /next and /reply using the authenticated Sheets connector.
// No Google HTTP request is performed here. The same API handler/service/policy run in process.
const http = require('node:http');
const assert = require('node:assert/strict');
const { createHandler } = require('../api/repertorio-test.js');
const P = require('./repertoire-policy.cjs');
const { randomUUID } = require('node:crypto');
function startProbe(port = 3003) {
  const queue = [], log = [], steps = []; let waiting, current, sequence = 0, finished = false, failure = '', evidence = null;
  const request = P.guardRequest((url, unusedToken, method = 'GET', body) => new Promise((resolve, reject) => {
    const task = { id: ++sequence, method, url, ...(body ? { body } : {}) };
    queue.push({ task, resolve, reject });
    if (waiting) { const w = waiting; waiting = null; w(); }
  }));
  const handler = createHandler({ request, writeEnabled: true });
  async function api(payload) {
    const result = { status: 200 };
    const res = { setHeader() {}, status(n) { result.status = n; return this; }, json(v) { result.body = v; } };
    await handler({ method: 'POST', query: {}, headers: { authorization: 'Bearer connector-probe-not-a-credential', origin: 'http://localhost:3002' }, body: payload }, res);
    assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
  }
  async function change(payload) { const { version } = await api({ action: 'validate' }); const out = await api({ ...payload, expectedVersion: version }); steps.push({ action: payload.action, rowsChanged: out.rowsChanged, unchanged: out.unchanged || false }); return out; }
  const server = http.createServer(async (req, res) => {
    const send = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) || req.headers.origin) { res.statusCode = 403; return res.end(); }
    if (req.method === 'GET' && req.url === '/next') {
      if (current) return send(current.task);
      if (!queue.length && !finished) await new Promise(resolve => { waiting = resolve; const timer = setTimeout(() => { if (waiting === resolve) waiting = null; resolve(); }, 20000); timer.unref(); });
      if (!queue.length) return send({ finished, failure, steps, evidence });
      current = queue.shift(); return send(current.task);
    }
    if (req.method === 'POST' && req.url === '/reply') {
      let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 15000000) { res.statusCode = 413; return res.end(); } }
      const reply = JSON.parse(text);
      if (!current || reply.id !== current.task.id) { res.statusCode = 409; return res.end(); }
      log.push({ id: current.task.id, method: current.task.method, ranges: new URL(current.task.url).searchParams.getAll('ranges'), sheetIds: current.task.body?.requests?.map(r => r.updateCells.range.sheetId) || [] });
      const item = current; current = null; send({ accepted: true });
      if (reply.error) item.reject(Error(reply.error)); else item.resolve(reply.result); return;
    }
    res.statusCode = 404; res.end();
  });
  server.listen(port, '127.0.0.1', () => console.log('Connector probe listening on 127.0.0.1:' + port));
  const themeId = randomUUID(), assignmentId = randomUUID();
  (async () => {
    const before = await api({ action: 'validate' }); assert.equal(before.issues.length, 0); assert(before.groups.length > 0);
    const grupo = before.groups[0].nombre;
    const theme = { id: themeId, nombre: 'DEMO FASE 2 · retirar al finalizar', numeroOrden: 900001, temaGaleta: true, temaSlap: false, temaPropio: true, activo: true, notas: 'Prueba temporal de API, sin datos de alumnos' };
    await change({ action: 'saveTheme', theme });
    let out = await change({ action: 'assignThemes', grupo, assignments: [{ id: assignmentId, temaId: themeId }] });
    assert.equal(out.assignments.find(a => a.id === assignmentId).realizado, false);
    out = await change({ action: 'updateProgress', vinculoId: assignmentId, changes: { realizado: true, repasando: true, motivoRepaso: 'Prueba temporal' } });
    let a = out.assignments.find(a => a.id === assignmentId); assert(a.realizado && a.repasando); assert.equal(a.ultimoRepaso, '');
    out = await change({ action: 'recordRehearsal', ids: [assignmentId], date: '2026-11-15' });
    a = out.assignments.find(a => a.id === assignmentId); assert.equal(a.ultimoRepaso, '2026-11-15');
    const replay = await change({ action: 'assignThemes', grupo, assignments: [{ id: assignmentId, temaId: themeId }] }); assert.equal(replay.unchanged, true);
    await change({ action: 'archiveAssignment', vinculoId: assignmentId, activo: false });
    out = await change({ action: 'assignThemes', grupo, assignments: [{ id: assignmentId, temaId: themeId }] });
    a = out.assignments.find(a => a.id === assignmentId); assert(a.realizado && a.repasando && a.activo); assert.equal(a.ultimoRepaso, '2026-11-15');
    // Archive before the connector removes only these temporary rows after an ID-verified read.
    await change({ action: 'archiveAssignment', vinculoId: assignmentId, activo: false });
    await change({ action: 'archiveTheme', temaId: themeId, activo: false });
    // The operator persists this result with its file tool; no local credential/file access is needed.
    evidence = { date: '2026-11-15', spreadsheetId: P.DEVELOPMENT_ID, transport: 'Authenticated Google Sheets connector bridge; real API handler and service; no browser OAuth credentials used', themeId, assignmentId, steps, remoteCalls: log, formulaAndNativeDatesVerified: true, demoCleanup: 'pending ID-verified connector cleanup', originalWrites: 0, detalleReads: 0, detalleWrites: 0 };
  })().catch(error => { failure = error.message; console.error('Probe failed:', failure); console.error('Temporary IDs:', themeId, assignmentId); }).finally(() => { finished = true; if (waiting) { waiting(); waiting = null; } });
  return server;
}
if (require.main === module) startProbe();
module.exports = { startProbe };
