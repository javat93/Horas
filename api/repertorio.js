'use strict';
const { createHandler } = require('./repertorio-test.js');
const activation = require('../release/repertoire-activation.json');
function productionHandler(options = {}) {
  const verified = activation.migrationVerified === true && activation.spreadsheetId === '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60' && activation.sheetIds.Temas === 155111501 && activation.sheetIds.GrupoTemas === 155111502;
  if (!verified && !options.verifiedForTest) return async (req, res) => res.status(503).json({ error: 'El repertorio todavía no está activado.', code: 'MIGRATION_REQUIRED' });
  return createHandler({ ...options, profile: 'production', writeEnabled: options.writeEnabled ?? activation.writeEnabled,
    origins: ['https://javat93.github.io', 'https://horas-git-main-javat93s-projects.vercel.app', 'https://horas.vercel.app', 'http://localhost:3002', 'http://127.0.0.1:3002', 'null'] });
}
module.exports = productionHandler();
module.exports.productionHandler = productionHandler;
