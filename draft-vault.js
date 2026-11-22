(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DraftVault=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create(storage,namespace,now=Date.now,onError=()=>{}){
 const prefix='horas:drafts:v1:'+namespace+':',ttl=7*86400000;
 function remove(kind){try{storage.removeItem(prefix+kind);}catch{}}
 function read(kind){try{const r=JSON.parse(storage.getItem(prefix+kind)||'null');if(!r||r.schema!==1||!Number.isFinite(r.savedAt)||now()-r.savedAt>ttl||r.savedAt>now()+60000){remove(kind);return null;}return r.value;}catch{remove(kind);return null;}}
 function save(kind,value){try{const text=JSON.stringify({schema:1,savedAt:now(),value});if(text.length>200000){onError();return false;}storage.setItem(prefix+kind,text);return true;}catch{onError();return false;}}
 function list(){const out=[];try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)){const kind=key.slice(prefix.length),value=read(kind);if(value)out.push({kind,value});}}}catch{}return out;}
 return{save,read,remove,list};
}
return{create};});
