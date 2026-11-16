'use strict';
const C = require('../group-courses.js'), S = require('../sandbox/group-courses-service.cjs');
const origins = ['https://javat93.github.io', 'https://horas-git-main-javat93s-projects.vercel.app', 'https://horas.vercel.app', 'http://localhost:3002', 'http://127.0.0.1:3002'];
async function googleRequest(url, token, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { Authorization: token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  const data = await r.json(); if (!r.ok) throw Object.assign(Error(data.error?.message || 'Error de Google.'), { status: r.status }); return data;
}
function createHandler({ request = googleRequest } = {}) {
  const service = S.createService();
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Origin'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers?.origin;
    if (origin && !origins.includes(origin)) return res.status(403).json({ error: 'Origen no permitido.' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method === 'GET' && req.query?.api === 'environment') return res.json({ mode: 'group-courses-production', spreadsheetId: C.TARGET, sheetId: C.SHEET_ID, writeEnabled: true, writableSheets: ['GruposCurso'], calendarAccess: false });
    if (req.method !== 'POST' || Object.keys(req.query || {}).length) return res.status(405).json({ error: 'Operación no permitida.' });
    try {
      S.validate(req.body);
      if (!/^Bearer [^\s]+$/.test(req.headers?.authorization || '')) C.fail('Usa la conexión de Google de la aplicación.', 'AUTH_REQUIRED', 401);
      return res.json(await service.run(req.body, req.headers.authorization, request));
    } catch (e) { return res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({ error: e.message, code: e.code || 'UPSTREAM_ERROR' }); }
  };
}
module.exports = createHandler(); module.exports.createHandler = createHandler;
