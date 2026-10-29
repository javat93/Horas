const {TEST_ID,validateTarget}=require('./policy.cjs');
const {snapshot}=require('./protected-service.cjs');
const {fingerprint}=require('./locale-service.cjs');
const D=require('../locale-data.js');
const BASE=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`;
const isPaid=cell=>D.value(cell)===true||D.value(cell)==='X';
async function runState(payload,token,request){
  validateTarget(payload.spreadsheetId);
  if(payload.action==='autoPerformed')return require('./performed-service.cjs').runPerformed(payload,token,request);
  if(payload.action!=='setPayment'||Object.keys(payload).some(k=>!['spreadsheetId','action','rowIdx','paid','expectedVersion'].includes(k))||typeof payload.paid!=='boolean'||!Number.isInteger(payload.rowIdx)||payload.rowIdx<2||typeof payload.expectedVersion!=='string')throw new Error('Cambio de pago no válido.');
  const snap=await snapshot(token,request),row=snap.rows[payload.rowIdx-1];
  if(!row||!String(D.value(row[8])).trim()||!D.dateISO(row[5]))throw new Error('Completa grupo y fecha de la sesión antes de cambiar su pago.');
  if(fingerprint(row)!==payload.expectedVersion)throw new Error('La fila cambió desde la carga. Recarga antes de cambiar el pago.');
  if(row[0]?.userEnteredValue?.formulaValue)throw new Error('El pago procede de una fórmula. Revísalo en la hoja antes de sustituirla.');
  const formula=row[6]?.userEnteredValue?.formulaValue,safeFormula=new RegExp('^=\\s*\\$?E\\$?'+payload.rowIdx+'\\s*\\*\\s*\\$?H\\$?'+payload.rowIdx+'\\s*$','i');
  if(row[4]?.userEnteredValue?.formulaValue||(formula&&!safeFormula.test(formula)))throw new Error('El importe usa una fórmula que podría variar con el pago. Revísala en la hoja.');
  const raw=D.value(row[0]);if(!['','X',true,false].includes(raw))throw new Error('El estado de pago no se reconoce. Revísalo en la hoja.');
  if(isPaid(row[0])===payload.paid)return {unchanged:true,paid:payload.paid,version:fingerprint(row),spreadsheetId:TEST_ID,calendarModified:false};
  const value=typeof raw==='boolean'?{boolValue:payload.paid}:payload.paid?{stringValue:'X'}:null;
  try{
    await request(`${BASE}:batchUpdate`,token,'POST',{requests:[{updateCells:{range:{sheetId:0,startRowIndex:payload.rowIdx-1,endRowIndex:payload.rowIdx,startColumnIndex:0,endColumnIndex:1},rows:[{values:[value?{userEnteredValue:value}:{}]}],fields:'userEnteredValue'}}]});
  }catch(error){throw new Error('No se pudo confirmar el pago. Puede que la petición llegara a Google; recarga antes de repetir. '+error.message);}
  let after;try{after=(await snapshot(token,request)).rows[payload.rowIdx-1];}catch(error){throw new Error('El pago se envió, pero falta comprobarlo. Recarga antes de repetir. '+error.message);}
  if(!after||isPaid(after[0])!==payload.paid)throw new Error('El pago se envió, pero no coincide al comprobarlo. Recarga antes de repetir.');
  if(fingerprint(after.slice(1))!==fingerprint(row.slice(1)))throw new Error('El pago se guardó, pero cambió otro dato de la sesión. Recarga antes de continuar.');
  return {paid:payload.paid,version:fingerprint(after),spreadsheetId:TEST_ID,calendarModified:false};
}
module.exports={runState,isPaid};
