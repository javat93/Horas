const assert=require('node:assert/strict'),S=require('../daily-service.cjs'),D=require('../../locale-data.js');
const clone=v=>JSON.parse(JSON.stringify(v)),c=v=>v===''?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v}};
function fake(){
  const grids=new Map([[0,[['Pago','Hecho','Bolo','Clase','Precio','Fecha','Total','H','Grupo','Barrio','CalendarId','Dirección','Inicio','Fin','Excepción'].map(c)]],[758405382,[['Grupo','Dirección','Precio','Bolo','Barrio'].map(c),['Moli de finestrelles','Dirección de catálogo',24,50,'Barrio catálogo'].map(c)]]]);
  const props=new Map([[0,{sheetId:0,title:'Detalle',gridProperties:{rowCount:2000,columnCount:15}}],[758405382,{sheetId:758405382,title:'Coles',gridProperties:{rowCount:100,columnCount:5}}]]),meta=[],calls=[];let throwAfterWrite=false;
  const native=rows=>rows.map(row=>({values:row.map(cell=>({...clone(cell),...(cell.userEnteredValue?{effectiveValue:clone(cell.userEnteredValue)}:{}),...(cell.userEnteredFormat?{effectiveFormat:clone(cell.userEnteredFormat)}:{})}))}));
  const request=async(url,token,method='GET',body)=>{
    calls.push({url,method,body:clone(body||{})});const u=new URL(url);
    if(url.startsWith('https://www.googleapis.com/calendar')){assert.equal(method,'GET');if(u.pathname.includes('/events/'))return clone(events.find(e=>e.id===decodeURIComponent(u.pathname.split('/events/')[1]))||{status:'cancelled'});const p=u.searchParams.get('pageToken');return clone(p?{items:events2}:{items:events,...(events2.length?{nextPageToken:'page2'}:{})});}
    assert(url.startsWith(S.BASE),'Solo la copia');
    if(u.pathname.endsWith('/developerMetadata:search'))return {matchedDeveloperMetadata:clone(meta).map(developerMetadata=>{if(developerMetadata.location.dimensionRange?.sheetId===0)delete developerMetadata.location.dimensionRange.sheetId;return {developerMetadata};})};
    if(method==='POST'){
      for(const r of body.requests){
        if(r.addSheet){const p=clone(r.addSheet.properties);props.set(p.sheetId,p);grids.set(p.sheetId,[]);}
        if(r.appendCells){const a=r.appendCells;grids.get(a.sheetId).push(...a.rows.map(r=>clone(r.values)));}
        if(r.updateCells){const a=r.updateCells,rows=grids.get(a.range.sheetId);for(let i=0;i<a.rows.length;i++){const idx=a.range.startRowIndex+i;rows[idx]||=[];for(let j=0;j<a.rows[i].values.length;j++){const col=a.range.startColumnIndex+j,incoming=clone(a.rows[i].values[j]);if(a.fields==='userEnteredValue'){rows[idx][col]||={};delete rows[idx][col].userEnteredValue;if(incoming.userEnteredValue)rows[idx][col].userEnteredValue=incoming.userEnteredValue;}else rows[idx][col]=incoming;}}}
        if(r.createDeveloperMetadata)meta.push({...clone(r.createDeveloperMetadata.developerMetadata),metadataId:meta.length+1});
      }
      if(throwAfterWrite){throwAfterWrite=false;throw Error('timeout tras confirmar Google');}return {};
    }
    if(u.pathname.endsWith('values:batchGet'))return {valueRanges:[0,758405382].map(id=>({values:grids.get(id).map(row=>row.map(D.value))}))};
    if(u.pathname.includes('/values/')){const title=decodeURIComponent(u.pathname.split('/values/')[1]).replace(/^'/,'').split("'")[0];const id=[...props].find(([,p])=>p.title===title)?.[0];return {values:(grids.get(id)||[]).map(row=>row.map(D.value))};}
    if(u.searchParams.get('fields')?.startsWith('properties(locale'))return {properties:{locale:'es_ES',timeZone:'Europe/Madrid'},sheets:[...props.values()].map(properties=>({properties:clone(properties),developerMetadata:u.searchParams.get('fields').includes('gridProperties),developerMetadata')?clone(meta.filter(m=>(m.location.sheetId??m.location.dimensionRange?.sheetId)===properties.sheetId)):[]})),developerMetadata:[]};
    const ranges=u.searchParams.getAll('ranges');if(ranges.length===1){if(ranges[0].startsWith('Coles!'))return {sheets:[{properties:clone(props.get(758405382)),data:[{rowData:native(grids.get(758405382))}]}]};const row=Number(ranges[0].match(/A(\d+)/)[1]);return {sheets:[{properties:clone(props.get(758405382))},{properties:clone(props.get(0)),data:[{startRow:row-1,rowData:(u.searchParams.get('fields')||'').includes('effectiveValue')?native([grids.get(0)[row-1]||[]]):[{values:clone(grids.get(0)[row-1]||[])}]}]}]};}
    return {sheets:[0,758405382].map(id=>({properties:clone(props.get(id)),data:[{startRow:0,rowData:native(grids.get(id))}]}))};
  };
  let events=[],events2=[];
  return {request,grids,meta,calls,props,setEvents:(a,b=[])=>{events=a;events2=b;},timeout:()=>throwAfterWrite=true};
}

module.exports={fake,clone,c};
