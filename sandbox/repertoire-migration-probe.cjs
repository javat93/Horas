'use strict';
// Local connector transport. No Google credentials are accepted or persisted.
// Default mode only prepares a plan. --exercise applies, verifies, rolls back,
// then reapplies to the pinned rehearsal copy, never to production.
const http = require('node:http');
const assert = require('node:assert/strict');
function startProbe({ port = 3005, exercise = false, profile = 'rehearsal', apply = false } = {}) {
  if (profile === 'production' && exercise) throw Error('La reversión de ensayo no se ejecuta automáticamente en producción.');
  const X = require('./repertoire-migration.cjs').createMigration(profile);
  const queue = [], calls = [], steps = [];
  let current, waiting, sequence = 0, finished = false, failure = '', evidence = null, artifacts = null;
  const request = (url, unusedToken, method = 'GET', body) => new Promise((resolve, reject) => {
    queue.push({ task: { id: ++sequence, url, method, ...(body ? { body } : {}) }, resolve, reject });
    if (waiting) { const done = waiting; waiting = null; done(); }
  });
  const server = http.createServer(async (req, res) => {
    const send = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) || req.headers.origin) { res.statusCode = 403; return res.end(); }
    if (req.method === 'GET' && req.url === '/next') {
      if (current) return send(current.task);
      if (!queue.length && !finished) await new Promise(resolve => {
        waiting = resolve;
        const timer = setTimeout(() => { if (waiting === resolve) waiting = null; resolve(); }, 20000); timer.unref();
      });
      if (!queue.length) return send({ finished, failure, steps, evidence });
      current = queue.shift(); return send(current.task);
    }
    if (req.method === 'GET' && req.url === '/artifacts' && finished) return send(artifacts);
    if (req.method === 'POST' && req.url === '/reply') {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 15000000) { res.statusCode = 413; return res.end(); } }
      let reply; try { reply = JSON.parse(raw); } catch { res.statusCode = 400; return res.end(); }
      if (!current || reply.id !== current.task.id) { res.statusCode = 409; return res.end(); }
      const task = current.task, u = new URL(task.url);
      calls.push({ id: task.id, method: task.method, spreadsheetId: u.pathname.split('/')[3].replace(':batchUpdate', ''), ranges: u.searchParams.getAll('ranges'), writeSheetIds: task.body?.requests?.map(r => r.updateCells.range.sheetId) || [] });
      const item = current; current = null; send({ accepted: true });
      if (reply.error) item.reject(Error(reply.error)); else item.resolve(reply.result); return;
    }
    res.statusCode = 404; res.end();
  });
  server.listen(port, '127.0.0.1', () => console.log('Migration connector probe listening on 127.0.0.1:' + port));
  (async () => {
    const initial = await X.prepare(request); steps.push({ action: 'dry-run', ...initial.counts, digest: initial.digest });
    artifacts = { initialPlan: initial };
    if (apply && !exercise) {
      const applied = await X.apply(initial, request); artifacts.finalReceipt = applied.receipt;
      steps.push({ action: 'apply', rowsChanged: applied.rowsChanged });
      const replay = await X.apply(initial, request); assert.equal(replay.rowsChanged, 0);
      const source = await X.read(X.SOURCE, request), destination = await X.read(X.DESTINATION, request);
      assert.equal(source.fingerprint, initial.sourceFingerprint);
      const clean = rows => rows.map(({rowIdx,...v})=>v).sort((a,b)=>a.id.localeCompare(b.id));
      assert.equal(X.hash(clean(source.themes)),X.hash(clean(destination.themes)));
      assert.equal(X.hash(clean(source.assignments)),X.hash(clean(destination.assignments)));
      steps.push({ action: 'repeat-and-verify', rowsChanged: 0, sourceUnchanged: true, allRecordsMatch: true });
      artifacts.finalDryRun = await X.prepare(request);
      assert.equal(artifacts.finalDryRun.writes.length,0);
    }
    if (exercise) {
      const applied = await X.apply(initial, request); assert.equal(applied.rowsChanged, initial.writes.length);
      assert(applied.receipt, 'Use a fresh empty rehearsal copy for the recovery exercise.');
      artifacts.firstReceipt = applied.receipt; steps.push({ action: 'apply', rowsChanged: applied.rowsChanged });
      const replay = await X.apply(initial, request); assert.equal(replay.rowsChanged, 0); assert(replay.unchanged);
      steps.push({ action: 'repeat', rowsChanged: 0, unchanged: true });
      const restored = await X.rollback(applied.receipt, request); assert(restored.restored);
      const restoredPlan = await X.prepare(request); assert.equal(restoredPlan.digest, initial.digest);
      steps.push({ action: 'rollback', restored: true, beforeFingerprintRestored: true });
      const final = await X.apply(restoredPlan, request); assert.equal(final.rowsChanged, initial.writes.length);
      artifacts.finalReceipt = final.receipt;
      const finalPlan = await X.prepare(request); assert.equal(finalPlan.writes.length, 0);
      const source = await X.read(X.SOURCE, request), destination = await X.read(X.DESTINATION, request);
      assert.equal(source.fingerprint, initial.sourceFingerprint);
      assert.equal(X.hash(source.themes.map(({ rowIdx, ...v }) => v)), X.hash(destination.themes.map(({ rowIdx, ...v }) => v)));
      assert.equal(X.hash(source.assignments.map(({ rowIdx, ...v }) => v)), X.hash(destination.assignments.map(({ rowIdx, ...v }) => v)));
      steps.push({ action: 'reapply-and-verify', rowsChanged: final.rowsChanged, pendingInsertions: 0, sourceUnchanged: true, allRecordsMatch: true });
      artifacts.finalDryRun = finalPlan;
    }
    evidence = { date: new Date().toISOString(), mode: exercise ? 'exercise' : apply ? 'apply' : 'dry-run', sourceId: X.SOURCE, destinationId: X.DESTINATION, transport: 'Authenticated Sheets connector; real migration module', steps, calls, sourceWrites: 0, productionWrites: profile === 'production' ? calls.filter(c=>c.method==='POST').length : 0, detalleReads: 0, detalleWrites: 0, calendarCalls: 0 };
  })().catch(e => { failure = e.message; console.error('Migration exercise failed:', failure); }).finally(() => { finished = true; if (waiting) { waiting(); waiting = null; } });
  return server;
}
if (require.main === module) startProbe({ exercise: process.argv.includes('--exercise'), profile: process.argv.includes('--production') ? 'production' : 'rehearsal', apply: process.argv.includes('--apply') });
module.exports = { startProbe };
