(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroupIdentity=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
  const school=Object.freeze({id:'cole:moli-finestrelles',aliases:Object.freeze(['Molí de finestrelles','Moli de finestrelles','Tramuntana']),previous:'Molí de finestrelles',current:'Tramuntana',since:'2026-01-01'});
  const known=name=>school.aliases.some(alias=>normalize(alias)===normalize(name));
  const id=name=>known(name)?school.id:normalize(name)?'nombre:'+normalize(name):'';
  const same=(a,b)=>!!id(a)&&id(a)===id(b);
  function validDate(iso){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return false;const date=new Date(iso+'T00:00:00Z');return !Number.isNaN(+date)&&date.toISOString().slice(0,10)===iso;}
  function label(name,iso){return known(name)&&validDate(iso)?iso<school.since?school.previous:school.current:String(name||'');}
  const catalogLabel=name=>known(name)?school.current:String(name||'');
  const description=name=>known(name)?'Antes Molí de finestrelles · Tramuntana desde 01/01/2026':'';
  const matches=(name,query)=>[name,catalogLabel(name),...(known(name)?school.aliases:[])].some(text=>normalize(text).includes(normalize(query)));
  function resolve(groups,name){const found=groups.filter(g=>same(g.nombre,name));if(found.length>1)throw new Error('Hay varias filas de catálogo para el mismo cole. Revisa los grupos antes de guardar o importar.');return found[0]||null;}
  function totals(rows){const sums=new Map();for(const row of rows){const key=id(row.grupo);if(!key)continue;const entry=sums.get(key)||{id:key,name:catalogLabel(row.grupo),sessions:0,total:0};entry.sessions++;if(typeof row.total==='number'&&Number.isFinite(row.total))entry.total+=row.total;sums.set(key,entry);}return [...sums.values()];}
  return {school,normalize,known,id,same,label,catalogLabel,description,matches,resolve,totals};
});
