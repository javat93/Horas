'use strict';
const P = require('../sandbox/repertoire-policy.cjs');
const M = require('../repertoire-model.js');
const S = require('../sandbox/repertoire-service.cjs');
const services = { development: S, production: S.createService(P.createPolicy('production')) };
async function googleRequest(url, token, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Error de Google.'), { status: response.status });
  return data;
}
function createHandler({ request = googleRequest, writeEnabled = false, origins = ['http://localhost:3002', 'http://127.0.0.1:3002'], profile = 'development' } = {}) {
  const policy = P.createPolicy(profile), service = services[profile];
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers?.origin;
    if (origin && !origins.includes(origin)) return res.status(403).json({ error: 'Origen no permitido.', code: 'FORBIDDEN_ORIGIN' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    const environment = { mode: policy.MODE, phase: profile === 'production' ? 5 : 3, spreadsheetId: policy.TARGET_ID, writeEnabled, writableSheets: ['Temas', 'GrupoTemas'], legacyOperationsEnabled: false, calendarAccess: false, sessionKey: 'horas-repertoire-' + profile + '-token' };
    if (req.method === 'GET' && req.query?.api === 'environment') return res.json({ ...environment, progressBatch: true });
    if (req.method === 'GET' && req.query?.api === 'oauth') return res.json({ clientId: '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com', scopes: 'https://www.googleapis.com/auth/spreadsheets', sessionKey: environment.sessionKey });
    if (req.method !== 'POST' || Object.keys(req.query || {}).length) return res.status(405).json({ error: 'Ruta o método no permitido.' });
    try {
      service.validatePayload(req.body);
      if (!writeEnabled && !service.READ_ACTIONS.includes(req.body.action)) M.fail('Escritura de repertorio desactivada.', 'READ_ONLY', 403);
      if (!/^Bearer [^\s]+$/.test(req.headers?.authorization || '')) M.fail('Conecta Google en el acceso de desarrollo.', 'AUTH_REQUIRED', 401);
      return res.json(await service.runRepertoire(req.body, req.headers.authorization, request));
    } catch (error) {
      return res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({ error: error.message, code: error.code || 'UPSTREAM_ERROR' });
    }
  };
}
module.exports = createHandler({ writeEnabled: process.env.REPERTOIRE_DEVELOPMENT_WRITES === 'enabled' });
module.exports.createHandler = createHandler;
