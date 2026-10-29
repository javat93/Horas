(() => {
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  window.mountIdentityReview=banner=>{
    if(document.getElementById('identity-review'))return;
    const wrapper=node('section');wrapper.id='identity-review';wrapper.style.cssText='margin-top:12px;border-top:1px solid #b8ac7a;padding-top:12px';banner.append(wrapper);
    wrapper.append(node('p','Molí de finestrelles y Tramuntana son el mismo cole. Hasta 2025 se muestra Molí; desde 01/01/2026, Tramuntana. Puedes buscar cualquiera de los nombres.'));
    const button=node('button','Comprobar histórico Molí / Tramuntana');button.type='button';button.style.cssText='padding:8px;border:1px solid currentColor;border-radius:6px';wrapper.append(button);const status=node('p');status.setAttribute('role','status');const list=node('div');wrapper.append(status,list);
    button.onclick=async()=>{
      button.disabled=true;status.textContent='Leyendo el mismo cole y sus sesiones. No se escribe nada…';list.replaceChildren();
      try{
        const data=await window.loadNativeData(),catalog=data.groups.filter(row=>GroupIdentity.known(row[0]));
        const sessions=data.details.map((row,i)=>({rowIdx:i+2,grupo:row[8],fechaStr:row[5],total:LocaleData.numeric(row[6])})).filter(row=>GroupIdentity.known(row.grupo));
        const combined=GroupIdentity.totals(sessions)[0];
        status.textContent=`${catalog.length} fila(s) de cole · ${sessions.length} sesiones · Total histórico: ${LocaleData.currency(combined?.total||0)}. ${catalog.length===1?'Identidad única comprobada.':'Revisa el catálogo: debe existir una sola fila.'}`;
        if(sessions.some(row=>row.total===null))list.append(node('p','Hay importes sin interpretar: no se incluyen en el total. Revisa los números pendientes.'));
        list.append(node('p','La hoja conserva su referencia existente para mantener unidos sus resúmenes. No se crean coles ni se cambian títulos de Calendar.'));
        const byYear=new Map();for(const row of sessions){const iso=LocaleData.parseSpanish(row.fechaStr),year=iso?iso.slice(0,4):'Fecha pendiente';const group=byYear.get(year)||[];group.push({...row,iso});byYear.set(year,group);}
        for(const [year,rows]of [...byYear].sort((a,b)=>a[0].localeCompare(b[0]))){
          const details=node('details');details.append(node('summary',`${year}: ${rows.length} sesiones · ${LocaleData.currency(rows.reduce((n,row)=>n+(row.total??0),0))}`));
          for(const row of rows){const warning=data.warnings.some(w=>w.rowIdx===row.rowIdx);details.append(node('p',`Fila ${row.rowIdx} · ${row.fechaStr} · ${GroupIdentity.label(row.grupo,row.iso)} · ${row.total===null?'Revisar importe':LocaleData.currency(row.total)}${warning?' · Fecha pendiente de revisión':''}`));}list.append(details);
        }
      }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
    };
  };
})();
