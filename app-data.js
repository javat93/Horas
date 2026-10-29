(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AppData=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const meaningful=value=>value!==undefined&&value!==null&&value!==false&&(typeof value!=='string'||value.trim()!=='');
  const hasContent=row=>Array.isArray(row)&&row.some(meaningful);
  function trimRows(rows,value){let end=rows.length;while(end>1&&!(rows[end-1]||[]).some(c=>meaningful(value(c))))end--;return rows.slice(0,end);}
  async function readResponse(response){
    const text=[204,205].includes(response.status)?'':await response.text();let data={};
    if(text.trim()){try{data=JSON.parse(text);}catch{throw new Error(`Respuesta del servidor no válida (${response.status}). Recarga antes de repetir una operación.`);}}
    if(!response.ok){const detail=typeof data.error==='string'?data.error:data.error?.message||data.message||response.statusText;const error=new Error(`Error ${response.status}: ${detail||'No se pudo completar la operación.'}`);error.status=response.status;throw error;}
    return data;
  }
  function createGate(){let busy=false;return {async run(work){if(busy)throw new Error('Hay otra operación guardando cambios. Espera a que termine.');busy=true;try{return await work();}finally{busy=false;}},isBusy:()=>busy};}
  function mutatingRequest(url,options={}){
    if(String(options.method||'GET').toUpperCase()!=='POST')return false;
    let body;try{body=JSON.parse(options.body||'{}');}catch{return false;}
    if(body.action)return !['data','audit','numbersAudit','preview','candidates'].includes(body.action);
    if(body.method)return !['get','list'].includes(body.method);
    return /(?:api=control|test-control)/.test(String(url));
  }
  return {meaningful,hasContent,trimRows,readResponse,createGate,mutatingRequest};
});
