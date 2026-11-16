'use strict';
// Explicit offline preview, separate from the real-copy server. No credentials and no Google calls.
const { fixture, id, theme } = require('./fixtures/repertoire.cjs');
const { createServer } = require('./repertoire-server.cjs');
async function createPreview({ productionLayout = false } = {}) {
  const f = fixture({ groups: ['Grupo A · Simulación', 'Grupo B · Simulación'], rowCount: 100 });
  await f.apply({ action: 'saveTheme', theme: theme(1, { nombre: 'Samba de roda', numeroOrden: 1 }) });
  await f.apply({ action: 'saveTheme', theme: theme(2, { nombre: 'Entrada Slap', numeroOrden: 1, temaGaleta: false, temaSlap: true }) });
  await f.apply({ action: 'saveTheme', theme: theme(3, { nombre: 'Maracuyá', numeroOrden: 1, temaGaleta: false, temaPropio: true }) });
  await f.apply({ action: 'saveTheme', theme: theme(4, { nombre: 'Corte de llamada', numeroOrden: 2, temaPropio: true }) });
  await f.apply({ action: 'assignThemes', grupo: 'Grupo A · Simulación', assignments: [1, 2, 3].map(n => ({ id: id(100 + n), temaId: id(n) })) });
  await f.apply({ action: 'assignThemes', grupo: 'Grupo B · Simulación', assignments: [{ id: id(201), temaId: id(1) }] });
  await f.apply({ action: 'updateProgress', vinculoId: id(101), changes: { realizado: true, fechaRealizado: '2026-11-05', ultimoRepaso: '2026-11-12' } });
  await f.apply({ action: 'updateProgress', vinculoId: id(102), changes: { realizado: true, repasando: true, fechaRealizado: '2026-11-10', motivoRepaso: 'Nuevas incorporaciones', proximoObjetivo: 'Revisar entrada y corte final' } });
  let next = '', conflictReads = 0;
  const request = async (...args) => {
    const [url, , method] = args;
    if (next === 'conflict' && method !== 'POST' && new URL(url).searchParams.get('includeGridData') === 'true' && ++conflictReads === 2) {
      f.book.sheets[0].data[0].rowData[1].values[7] = { userEnteredValue: { stringValue: 'Edición externa simulada' } };
      next = '';
    }
    if (next === 'uncertain' && method === 'POST') { next = ''; f.failAfterWrite = true; try { return await f.request(...args); } finally { f.failAfterWrite = false; } }
    return f.request(...args);
  };
  const control = payload => { if (!['conflict', 'uncertain', 'none'].includes(payload.next)) throw Error('Simulación no admitida.'); next = payload.next; conflictReads = 0; return { next }; };
  let pageHtml;
  // Legacy standalone development preview. The integrated production layout uses preview-production.cjs.
  if (productionLayout) pageHtml = require('node:fs').readFileSync(require('node:path').join(__dirname, 'repertoire-development.html'), 'utf8');
  return { server: createServer({ request, writeEnabled: true, preview: { control, pageHtml } }), fixture: f };
}
if (require.main === module) createPreview({ productionLayout: process.argv.includes('--production-layout') }).then(({ server }) => server.listen(3004, '127.0.0.1', () => console.log('SIMULACIÓN LOCAL · http://localhost:3004 · datos ficticios en memoria, sin acceso a Google')));
module.exports = { createPreview };
