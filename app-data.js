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
  const notSent=message=>Object.assign(new Error(message),{notSent:true});
  function createGate(){
    let busy=false,queued=0,tail=Promise.resolve();const waiters=[];
    async function run(work){if(busy)throw notSent('Hay otra operación guardando cambios. Espera a que termine.');busy=true;try{return await work();}finally{busy=false;for(const wake of waiters.splice(0))wake();}}
    return {run,enqueue(work){queued++;const job=tail.then(async()=>{while(busy)await new Promise(resolve=>waiters.push(resolve));return run(work);}).finally(()=>queued--);tail=job.catch(()=>{});return job;},isBusy:()=>busy||queued>0};
  }
  function mutatingRequest(url,options={}){
    if(String(options.method||'GET').toUpperCase()!=='POST')return false;
    let body;try{body=JSON.parse(options.body||'{}');}catch{return false;}
    if(body.action)return !['data','audit','numbersAudit','preview','candidates','trash','getPayment'].includes(body.action);
    if(body.method)return !['get','list'].includes(body.method);
    return /(?:api=control|test-control)/.test(String(url));
  }
  return {meaningful,hasContent,trimRows,readResponse,createGate,mutatingRequest,notSent};
});
