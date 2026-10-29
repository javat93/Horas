const D=require('../locale-data.js');
const {TEST_ID,validateTarget}=require('./policy.cjs');
const {createHash}=require('node:crypto');
const BASE=`https://sheets.googleapis.com/v4/spreadsheets/${TEST_ID}`;
const version=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
async function read(token,request){
  const q=new URLSearchParams({includeGridData:'true',fields:'sheets(properties(title),data(startRow,rowData(values(userEnteredValue,effectiveValue,formattedValue))))',ranges:'Coles!A1:E1220'});
  const result=await request(`${BASE}?${q}`,token),sheet=result.sheets?.find(s=>s.properties.title==='Coles');
  if(!sheet)throw new Error('No se pudo leer Coles.');
  const rows=[];for(const grid of sheet.data||[])for(const [i,r]of (grid.rowData||[]).entries())rows[(grid.startRow||0)+i]=Array.from({length:5},(_,c)=>r.values?.[c]||{});
  return rows;
}
function normalize(input){
  if(!input||Object.keys(input).some(k=>!['price','gigPrice','location','address'].includes(k)))throw new Error('Solo se permiten precios, barrio y dirección.');
  const out={};for(const key of ['price','gigPrice'])if(input[key]!==undefined){const n=D.numeric(input[key]);if(n===null||n<0)throw new Error('Introduce una tarifa numérica válida; no se usará una tarifa por defecto.');out[key]=n;}
  if(input.location!==undefined){if(typeof input.location!=='string'||input.location.length>500)throw new Error('Ubicación no válida.');out.location=input.location.trim();}
  if(input.address!==undefined){if(typeof input.address!=='string'||input.address.length>1000)throw new Error('Dirección no válida.');if(input.address.trim())out.address=input.address.trim();}
  return out;
}
const columns={address:1,price:2,gigPrice:3,location:4};
function plan(rows,payload){
  const r=payload.rowIdx;if(!Number.isInteger(r)||r<2||r>1220||!D.value(rows[r-1]?.[0]))throw new Error('Selecciona un grupo existente. Las altas se probarán en otra etapa.');
  const row=rows[r-1],proposal=normalize(payload.proposal),current={price:D.value(row[2]),gigPrice:D.value(row[3]),location:String(D.value(row[4])),address:String(D.value(row[1]))};
  const diff={};for(const key of Object.keys(proposal))diff[key]=['location','address'].includes(key)?current[key]!==proposal[key]:D.numeric(current[key])!==proposal[key];
  return {rowIdx:r,name:String(D.value(row[0])),current,proposal,diff,expectedVersion:version(row)};
}
async function runGroups(payload,token,request){
  validateTarget(payload.spreadsheetId);
  if(!['audit','preview','apply'].includes(payload.action))throw new Error('Acción no permitida.');
  const rows=await read(token,request);
  if(payload.action==='audit')return {spreadsheetId:TEST_ID,groups:rows.slice(1).flatMap((row,i)=>{
    if(!row||!D.value(row[0]))return [];
    const d=D.value(row[3]),e=D.value(row[4]),suspected=String(d).trim()!==''&&D.numeric(d)===null&&typeof d==='string'&&String(e).trim()!==''&&D.numeric(e)!==null;
    const notes=[];if(D.numeric(D.value(row[2]))===null)notes.push('Precio de sesión vacío o no numérico.');if(D.numeric(d)===null)notes.push('Precio Bolo vacío o no numérico.');if(suspected)notes.push('Posible cruce D/E: requiere confirmar; no se intercambia automáticamente.');
    return [{rowIdx:i+2,name:String(D.value(row[0])),current:{price:D.value(row[2]),gigPrice:d,location:e},suspected,notes}];
  }),calendarModified:false};
  const p=plan(rows,payload);
  if(payload.action==='preview')return {...p,spreadsheetId:TEST_ID};
  if(payload.expectedVersion!==p.expectedVersion)throw new Error('El grupo cambió desde la revisión. Vuelve a abrirlo antes de guardar.');
  const choices=payload.choices||{};if(Object.keys(choices).some(k=>!Object.hasOwn(columns,k))||Object.values(choices).some(v=>!['keep','use'].includes(v)))throw new Error('Decisión no válida.');
  const changes=[];for(const [key,col]of Object.entries(columns))if(choices[key]==='use'){
    if(!Object.hasOwn(p.proposal,key))throw new Error('No existe propuesta para ese campo.');
    if(p.diff[key])changes.push({key,col,value:p.proposal[key]});
  }
  if(!changes.length)return {unchanged:true,cellsChanged:0,spreadsheetId:TEST_ID,calendarModified:false};
  await request(`${BASE}:batchUpdate`,token,'POST',{requests:changes.map(c=>({updateCells:{range:{sheetId:758405382,startRowIndex:p.rowIdx-1,endRowIndex:p.rowIdx,startColumnIndex:c.col,endColumnIndex:c.col+1},rows:[{values:[{userEnteredValue:typeof c.value==='number'?{numberValue:c.value}:{stringValue:c.value},...(typeof c.value==='number'?{userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'#,##0.00" €"'}}}:{})}]}],fields:'userEnteredValue'+(typeof c.value==='number'?',userEnteredFormat.numberFormat':'')}}))});
  const after=(await read(token,request))[p.rowIdx-1];
  for(const c of changes)if(D.value(after?.[c.col])!==c.value)throw new Error('Cambio enviado, pero no verificado. Recarga antes de repetir.');
  return {cellsChanged:changes.length,spreadsheetId:TEST_ID,calendarModified:false};
}
module.exports={runGroups,normalize,plan};
