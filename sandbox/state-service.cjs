const {targetId,validateTarget}=require('./policy.cjs');
const {fingerprint}=require('./locale-service.cjs');
const D=require('../locale-data.js');
const base=()=>`https://sheets.googleapis.com/v4/spreadsheets/${targetId()}`;
const isPaid=cell=>D.value(cell)===true||D.value(cell)==='X';
async function paymentRow(rowIdx,token,request){
  const query=new URLSearchParams({includeGridData:'true',fields:'sheets(properties(title),data(startRow,rowData(values(userEnteredValue,effectiveValue,effectiveFormat(numberFormat)))))',ranges:`Detalle!A${rowIdx}:O${rowIdx}`});
  const data=await request(`${base()}?${query}`,token),sheet=data.sheets?.find(s=>s.properties.title==='Detalle');
  for(const grid of sheet?.data||[]){const rows=grid.rowData||[],index=grid.startRow===undefined?(rows.length===1?0:rowIdx-1):rowIdx-1-grid.startRow;if(index>=0&&rows[index])return Array.from({length:15},(_,i)=>rows[index].values?.[i]||{});}
  return null;
}
async function runState(payload,token,request){
  validateTarget(payload.spreadsheetId);
  if(payload.action==='autoPerformed')return require('./performed-service.cjs').runPerformed(payload,token,request);
  if(payload.action==='getPayment'){
    if(Object.keys(payload).some(k=>!['spreadsheetId','action','rowIdx'].includes(k))||!Number.isInteger(payload.rowIdx)||payload.rowIdx<2)throw Error('Fila de pago no válida.');
    const row=await paymentRow(payload.rowIdx,token,request);if(!row||!String(D.value(row[8])).trim())throw Error('La sesión ya no está disponible.');
    return {paid:isPaid(row[0]),version:fingerprint(row),spreadsheetId:targetId(),calendarModified:false};
  }
  if(payload.action!=='setPayment'||Object.keys(payload).some(k=>!['spreadsheetId','action','rowIdx','paid','expectedVersion'].includes(k))||typeof payload.paid!=='boolean'||!Number.isInteger(payload.rowIdx)||payload.rowIdx<2||typeof payload.expectedVersion!=='string')throw new Error('Cambio de pago no válido.');
  const row=await paymentRow(payload.rowIdx,token,request);
  if(!row||!String(D.value(row[8])).trim()||!D.dateISO(row[5]))throw new Error('Completa grupo y fecha de la sesión antes de cambiar su pago.');
  if(fingerprint(row)!==payload.expectedVersion)throw new Error('La fila cambió desde la carga. Recarga antes de cambiar el pago.');
  if(row[0]?.userEnteredValue?.formulaValue)throw new Error('El pago procede de una fórmula. Revísalo en la hoja antes de sustituirla.');
  const formula=row[6]?.userEnteredValue?.formulaValue,safeFormula=new RegExp('^=\\s*\\$?E\\$?'+payload.rowIdx+'\\s*\\*\\s*\\$?H\\$?'+payload.rowIdx+'\\s*$','i');
  if(row[4]?.userEnteredValue?.formulaValue||(formula&&!safeFormula.test(formula)))throw new Error('El importe usa una fórmula que podría variar con el pago. Revísala en la hoja.');
  const raw=D.value(row[0]);if(!['','X',true,false].includes(raw))throw new Error('El estado de pago no se reconoce. Revísalo en la hoja.');
  if(isPaid(row[0])===payload.paid)return {unchanged:true,paid:payload.paid,version:fingerprint(row),spreadsheetId:targetId(),calendarModified:false};
  const value=typeof raw==='boolean'?{boolValue:payload.paid}:payload.paid?{stringValue:'X'}:null;
  try{
    await request(`${base()}:batchUpdate`,token,'POST',{requests:[{updateCells:{range:{sheetId:0,startRowIndex:payload.rowIdx-1,endRowIndex:payload.rowIdx,startColumnIndex:0,endColumnIndex:1},rows:[{values:[value?{userEnteredValue:value}:{}]}],fields:'userEnteredValue'}}]});
  }catch(error){throw new Error('No se pudo confirmar el pago. Puede que la petición llegara a Google; recarga antes de repetir. '+error.message);}
  let after;try{after=await paymentRow(payload.rowIdx,token,request);}catch(error){throw new Error('El pago se envió, pero falta comprobarlo. Recarga antes de repetir. '+error.message);}
  if(!after||isPaid(after[0])!==payload.paid)throw new Error('El pago se envió, pero no coincide al comprobarlo. Recarga antes de repetir.');
  if(fingerprint(after.slice(1))!==fingerprint(row.slice(1)))throw new Error('El pago se guardó, pero cambió otro dato de la sesión. Recarga antes de continuar.');
  return {paid:payload.paid,version:fingerprint(after),spreadsheetId:targetId(),calendarModified:false};
}
module.exports={runState,isPaid};
