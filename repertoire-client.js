(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RepertoireClient=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function createProgressQueue({client,onChange=()=>{},delay=1200,maxWait=4000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
    const pending=new Map();let timer=null,firstAt=null,sending=null,error=null,paused=false,cooldownUntil=0,saved=false;
    const state=()=>({pending:pending.size,saving:!!sending,error,paused,retryInMs:Math.max(0,cooldownUntil-now()),saved});
    const notify=()=>onChange(state());
    const stop=()=>{if(timer!==null)cancel(timer);timer=null;};
    function arm(){stop();if(!pending.size||paused)return;const wait=Math.max(0,Math.min(delay,maxWait-(now()-firstAt)));timer=schedule(()=>{timer=null;flush(true).catch(()=>{});},wait);}
    function prune(){for(const[id,changes]of pending){const row=client.state().data?.assignments.find(a=>a.id===id);if(!row)continue;for(const key of Object.keys(changes))if(changes[key]===row[key])delete changes[key];if(!Object.keys(changes).length)pending.delete(id);}}
    function set(id,changes){
      if(!client.state().canWrite||sending)throw Error('Espera a que termine el guardado o revisa los datos antes de marcar.');
      if(!changes||!Object.keys(changes).length||Object.entries(changes).some(([k,v])=>!['realizado','repasando'].includes(k)||typeof v!=='boolean'))throw Error('Marcado no válido.');
      if(!client.state().data.assignments.some(a=>a.id===id))throw Error('Relación no encontrada.');
      pending.set(id,{...pending.get(id),...changes});prune();saved=false;
      if(firstAt===null)firstAt=now();if(!pending.size){stop();firstAt=null;}else arm();notify();
    }
    function flush(automatic=false){
      if(sending)return sending;
      stop();if(!pending.size||automatic&&paused)return Promise.resolve();
      if(cooldownUntil>now()){paused=true;timer=schedule(()=>{timer=null;notify();},cooldownUntil-now());notify();return Promise.reject(error||Error('Espera antes de volver a guardar.'));}
      if(!client.state().canWrite)return Promise.reject(error||Error('Actualiza y revisa los marcados antes de guardar.'));
      prune();if(!pending.size){firstAt=null;paused=false;error=null;saved=true;notify();return Promise.resolve();}
      const updates=[...pending].slice(0,50).map(([vinculoId,changes])=>({vinculoId,changes:{...changes}}));
      // Defer sending to let state expose the in-flight promise before client callbacks render.
      sending=Promise.resolve().then(()=>client.save({action:'updateProgressBatch',updates})).then(()=>{
        for(const u of updates){const current=pending.get(u.vinculoId);if(!current)continue;for(const[k,v]of Object.entries(u.changes))if(current[k]===v)delete current[k];if(!Object.keys(current).length)pending.delete(u.vinculoId);}
        error=null;paused=false;saved=true;firstAt=pending.size?now():null;
      }).catch(e=>{
        error=e;paused=true;saved=false;
        if(e.status===429||/quota exceeded|rate limit|cuota/i.test(e.message)){cooldownUntil=now()+60000;timer=schedule(()=>{timer=null;notify();},60000);}
        throw e;
      }).finally(()=>{sending=null;if(!paused)arm();notify();});notify();return sending;
    }
    return{state,set,flush,changes:id=>({...pending.get(id)}),acknowledge(){saved=false;},reviewed(){if(sending)throw Error('Espera al guardado.');error=null;paused=!!pending.size;notify();},discard(){if(sending)throw Error('Espera al guardado.');stop();pending.clear();firstAt=null;paused=false;error=null;saved=false;notify();}};
  }
  function forProfile(profile='development'){
  if(!['development','production'].includes(profile))throw Error('Perfil de repertorio no permitido.');
  const TARGET=profile==='production'?'1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60':'1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k',mode='repertoire-'+profile;
  function verifyEnvironment(e){if(e?.mode!==mode||e.spreadsheetId!==TARGET||e.calendarAccess!==false||e.legacyOperationsEnabled!==false||typeof e.writeEnabled!=='boolean'||JSON.stringify(e.writableSheets)!==JSON.stringify(['Temas','GrupoTemas']))throw Error('No se ha podido confirmar el destino de repertorio.');return e;}
  function verifyData(d){if(d?.mode!==mode||d.spreadsheetId!==TARGET||d.calendarModified!==false||d.legacyModified!==false||!/^[a-f0-9]{64}$/.test(d.version)||!['themes','assignments','groups','issues'].every(k=>Array.isArray(d[k])))throw Object.assign(Error('La respuesta no confirma los datos guardados del repertorio.'),{code:'UNVERIFIED_RESPONSE'});return d;}
  function create({transport,writeEnabled=false,onChange=()=>{}}){
    let data=null,busy=false,needsReload=false;
    const state=()=>({data,busy,needsReload,canWrite:writeEnabled&&!!data&&!busy&&!needsReload&&!data.issues.length});
    const notify=()=>onChange(state());
    async function load(){if(busy)throw Error('Hay una operación en curso.');busy=true;notify();try{data=verifyData(await transport({action:'validate'}));needsReload=false;return data;}catch(error){needsReload=true;throw error;}finally{busy=false;notify();}}
    async function save(payload){
      if(!state().canWrite)throw Error(needsReload?'Actualiza los datos antes de guardar.':'No se puede guardar en este momento.');
      if(!payload||['catalog','validate','groupRepertoire'].includes(payload.action)||'expectedVersion' in payload||'spreadsheetId' in payload)throw Error('Operación de interfaz no válida.');
      busy=true;notify();try{data=verifyData(await transport({...payload,expectedVersion:data.version}));return data;}catch(error){if(['REVIEW_EXPIRED','DATA_ISSUES','WRITE_UNCERTAIN','UNVERIFIED_RESPONSE'].includes(error.code)||error.status===429||!error.status||error.status>=500)needsReload=true;throw error;}finally{busy=false;notify();}
    }
    return{state,load,save,clear(){if(busy)throw Error('Espera a que termine la operación.');data=null;needsReload=false;notify();}};
  }
  return{TARGET,verifyEnvironment,verifyData,create,createProgressQueue};
  }
  return{...forProfile(),forProfile};
});
