'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('../api/repertorio-test.js');
function createServer({ request, writeEnabled = false } = {}) {
  return http.createServer(async (req, res) => {
    const port = req.socket.localPort, allowed = [`localhost:${port}`, `127.0.0.1:${port}`];
    const send = (status, value, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(type.startsWith('application/json') ? JSON.stringify(value) : value); };
    if (!allowed.includes(req.headers.host) || (req.headers.origin && !allowed.some(h => req.headers.origin === 'http://' + h))) return send(403, { error: 'Origen no permitido.' });
    const url = new URL(req.url, 'http://' + req.headers.host);
    if (req.method === 'GET' && url.pathname === '/') return send(200, fs.readFileSync(path.join(__dirname, 'repertoire-development.html'), 'utf8'), 'text/html; charset=utf-8');
    if (url.pathname !== '/api/repertorio-test') return send(404, { error: 'Este servidor solo expone el módulo de repertorio.' });
    try {
      let text = '';
      if (req.method === 'POST') {
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'Se requiere JSON.' });
        for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 100000) return send(413, { error: 'Petición demasiado grande.' }); }
      }
      req.body = text ? JSON.parse(text) : {};
      req.query = Object.fromEntries(url.searchParams);
      res.status = code => { res.statusCode = code; return res; };
      res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
      await createHandler({ request, writeEnabled, origins: allowed.map(h => 'http://' + h) })(req, res);
    } catch (error) { send(400, { error: error instanceof SyntaxError ? 'JSON no válido.' : error.message }); }
  });
}
if (require.main === module) {
  const writeEnabled = process.argv.includes('--write');
  const portOption = process.argv.find(a => a.startsWith('--port='));
  const port = portOption ? Number(portOption.slice(7)) : 3002;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Puerto local no válido.');
  createServer({ writeEnabled }).listen(port, '127.0.0.1', () => console.log(`Repertorio DESARROLLO: http://localhost:${port} · ${writeEnabled ? 'escritura solo en la copia' : 'solo lectura'}`));
}
module.exports = { createServer };
