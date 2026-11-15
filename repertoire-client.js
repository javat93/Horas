(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RepertoireClient=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TARGET='1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k';
  function verifyEnvironment(e){if(e?.mode!=='repertoire-development'||e.spreadsheetId!==TARGET||e.calendarAccess!==false||e.legacyOperationsEnabled!==false||typeof e.writeEnabled!=='boolean'||JSON.stringify(e.writableSheets)!==JSON.stringify(['Temas','GrupoTemas']))throw Error('No se ha podido confirmar la copia de desarrollo.');return e;}
  function verifyData(d){if(d?.mode!=='repertoire-development'||d.spreadsheetId!==TARGET||d.calendarModified!==false||d.legacyModified!==false||!/^[a-f0-9]{64}$/.test(d.version)||!['themes','assignments','groups','issues'].every(k=>Array.isArray(d[k])))throw Object.assign(Error('La respuesta no confirma los datos guardados en la copia.'),{code:'UNVERIFIED_RESPONSE'});return d;}
  function create({transport,writeEnabled=false,onChange=()=>{}}){
    let data=null,busy=false,needsReload=false;
    const state=()=>({data,busy,needsReload,canWrite:writeEnabled&&!!data&&!busy&&!needsReload&&!data.issues.length});
    const notify=()=>onChange(state());
    async function load(){if(busy)throw Error('Hay una operación en curso.');busy=true;notify();try{data=verifyData(await transport({action:'validate'}));needsReload=false;return data;}catch(error){needsReload=true;throw error;}finally{busy=false;notify();}}
    async function save(payload){
      if(!state().canWrite)throw Error(needsReload?'Actualiza los datos antes de guardar.':'No se puede guardar en este momento.');
      if(!payload||['catalog','validate','groupRepertoire'].includes(payload.action)||'expectedVersion' in payload||'spreadsheetId' in payload)throw Error('Operación de interfaz no válida.');
      busy=true;notify();try{data=verifyData(await transport({...payload,expectedVersion:data.version}));return data;}catch(error){if(['REVIEW_EXPIRED','DATA_ISSUES','WRITE_UNCERTAIN','UNVERIFIED_RESPONSE'].includes(error.code)||!error.status||error.status>=500)needsReload=true;throw error;}finally{busy=false;notify();}
    }
    return{state,load,save,clear(){if(busy)throw Error('Espera a que termine la operación.');data=null;needsReload=false;notify();}};
  }
  return{TARGET,verifyEnvironment,verifyData,create};
});
