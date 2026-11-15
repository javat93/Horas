'use strict';
const M = require('../repertoire-model.js');
const original = require('../projects/repertorio/bootstrap-copy.requests.json');
const config = require('../projects/repertorio/production.json');
function bootstrap(meta) {
  if (meta.spreadsheetId !== config.destinationSpreadsheetId || config.backupVerified !== true || config.productionAllowed !== true) M.fail('Falta verificar destino y respaldo.', 'FORBIDDEN_TARGET', 403);
  const props = meta.sheets.map(s => s.properties);
  if (props.some(s => ['Temas','GrupoTemas'].includes(s.title) || Object.values(config.sheetIds).includes(s.sheetId))) M.fail('Las pestañas ya existen; revisar sin repetir la preparación.', 'DESTINATION_CONFLICT', 409);
  const convert = (v, key) => key === 'sheetId' ? v === 142601101 ? config.sheetIds.Temas : v === 142601102 ? config.sheetIds.GrupoTemas : (()=>{throw Error('Pestaña ajena en plantilla');})() : Array.isArray(v) ? v.map(x=>convert(x)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x])=>[k,convert(x,k)])) : v;
  const allowed = ['addSheet','updateCells','repeatCell','setDataValidation','setBasicFilter','updateDimensionProperties','addProtectedRange'];
  const requests = original.requests.map(r => {
    if (Object.keys(r).length !== 1 || !allowed.includes(Object.keys(r)[0])) throw Error('Operación de plantilla no permitida');
    return convert(r);
  });
  return { spreadsheetId: meta.spreadsheetId, backupSpreadsheetId: config.backupSpreadsheetId, requests };
}
module.exports = { bootstrap };
