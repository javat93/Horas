(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RepertoireTemplates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
function candidates(ids,themes,assignments,grupo,same){const active=new Set(themes.filter(t=>t.activo).map(t=>t.id)),assigned=new Set(assignments.filter(a=>same(a.grupo,grupo)&&a.activo).map(a=>a.temaId));return [...new Set(ids)].filter(id=>active.has(id)&&!assigned.has(id)).slice(0,50);}
function builtins(themes){return [['temaGaleta','Galeta'],['temaSlap','Slap'],['temaPropio','Propios']].map(([key,nombre])=>({id:key,nombre,temaIds:themes.filter(t=>t.activo&&t[key]).map(t=>t.id)}));}
return{candidates,builtins};});
