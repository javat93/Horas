(function(){
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  async function api(action,extra={}){
    if(!await window.horasEnvironmentReady)throw new Error('El entorno de pruebas no está verificado.');
    const token=window.horasAccessToken ? window.horasAccessToken() : gapi.client?.getToken()?.access_token||localStorage.getItem('g_token_pruebas');if(!token)throw new Error('Primero conecta Google.');
    const response=await (window.horasFetch||fetch)(CONFIG.LOCALE_API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({spreadsheetId:CONFIG.SPREADSHEET_ID,action,...extra})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo completar la revisión de fechas.');return data;
  }
  window.loadNativeData=()=>api('data');
  window.updateLocaleWarnings=data=>{
    const notice=document.getElementById('locale-data-notice');if(!notice)return;
    notice.textContent=`Lectura nativa en castellano. La app usa el mismo día interno que Sheets. ${data.warnings.length} fechas difieren de su presentación anterior y requieren revisión.`+(data.amountWarnings.length?` Hay ${data.amountWarnings.length} campos numéricos ambiguos. Los importes pendientes no se incluyen en el total y se señalan en la lista.`:'');
  };
  window.mountLocaleReview=function(banner){
    if(document.getElementById('locale-data-notice'))return;
    const notice=node('p');notice.id='locale-data-notice';banner.append(notice);
    const open=node('button','Revisar fechas y formato español');open.type='button';open.style.cssText='display:block;padding:8px;margin-top:10px;border:1px solid currentColor;border-radius:6px';banner.append(open);
    const section=node('section');section.id='locale-review';section.hidden=true;section.style.cssText='max-width:1100px;margin:20px auto;padding:20px;background:white;border:1px solid #cbd5e1;border-radius:12px';banner.after(section);
    section.append(node('h2','Fechas, decimales y cálculos en castellano'));
    section.append(node('p','Cambiar el formato no repara una fecha interna equivocada. Revisa ambas fechas y la comprobación de Calendar. Sin selección no se cambia nada; no se intercambian días y meses en bloque.'));
    const status=node('p');status.setAttribute('role','status');section.append(status);
    const refresh=node('button','Volver a analizar'),formats=node('input'),rowSearch=node('input'),find=node('button','Buscar fecha por fila');refresh.type=find.type='button';formats.type='checkbox';rowSearch.type='number';rowSearch.min='2';
    rowSearch.style.cssText='width:90px;padding:6px;border:1px solid #94a3b8;margin:6px';
    section.append(refresh);const formatLabel=node('label',' Mostrar también cambios de formato ');formatLabel.append(formats);section.append(formatLabel);const searchLabel=node('label',' Fila de fecha: ');searchLabel.append(rowSearch);section.append(searchLabel,find);
    const selectVerified=node('button','Seleccionar lote respaldado (hasta 450)'),prepare=node('button','Revisar fechas seleccionadas');selectVerified.type=prepare.type='button';section.append(selectVerified,prepare);
    for(const button of [refresh,find,selectVerified,prepare])button.style.cssText='padding:8px;margin:8px;border:1px solid #64748b;border-radius:6px';
    const selectedText=node('p'),list=node('div'),pager=node('div'),confirmation=node('div');section.append(selectedText,list,pager,confirmation);
    const numbers=node('div');numbers.style.cssText='margin-top:24px;padding-top:12px;border-top:1px solid #cbd5e1';section.append(numbers);
    const prepareNumbers=node('button','Revisar números y formatos monetarios'),check=node('button','Probar suma y datos del gráfico');prepareNumbers.type=check.type='button';prepareNumbers.style.cssText=check.style.cssText='padding:8px;margin:8px;border:1px solid #64748b;border-radius:6px';numbers.append(prepareNumbers,check);const numberResult=node('div');numbers.append(numberResult);
    let review=null,busy=false,page=0,search='',selected=new Map();
    function count(){selectedText.textContent=`${selected.size} fechas seleccionadas (máximo 500 por lote).`;prepare.disabled=selected.size===0||selected.size>500;}
    async function action(work){if(busy)return;busy=true;for(const b of section.querySelectorAll('button,input,select'))b.disabled=true;try{await work();}catch(error){status.textContent=error.message;}finally{busy=false;for(const b of section.querySelectorAll('button,input,select'))b.disabled=false;const buttons=pager.querySelectorAll('button');if(buttons[0])buttons[0].disabled=page===0;if(buttons[1])buttons[1].disabled=(page+1)*50>=filtered().length;count();}}
    function filtered(){if(!review)return [];return review.dates.filter(p=>search?p.rowIdx===Number(search):formats.checked||p.conflict||p.textDate);}
    function draw(){
      list.replaceChildren();pager.replaceChildren();const plans=filtered(),visible=plans.slice(page*50,page*50+50);
      for(const plan of visible){const card=node('div');card.style.cssText='border-top:1px solid #cbd5e1;padding:12px 0';list.append(card);
        card.append(node('p',`Fila ${plan.rowIdx} · ${plan.group} · Interna: ${LocaleData.display(plan.internal)||'(no numérica)'} · Antes se mostraba: ${LocaleData.display(plan.visible)||'(sin fecha reconocida)'}`));
        card.append(node('p',plan.reason));if(plan.calendar)card.append(node('p',`Calendar: ${plan.calendar.title} · ${LocaleData.display(plan.calendar.date)}`));
        const label=node('label',`Decisión de fecha, fila ${plan.rowIdx}: `),select=node('select');select.setAttribute('aria-label',`Decisión de fecha, fila ${plan.rowIdx}:`);select.style.cssText='max-width:100%;border:1px solid #94a3b8;padding:8px';const keep=node('option','Dejar pendiente, sin cambios');keep.value='keep';select.append(keep);
        for(const choice of plan.choices){const option=node('option',`${choice.label}: ${LocaleData.display(choice.iso)}${plan.verified===choice.key?' · respaldada':''}`);option.value=choice.key;select.append(option);}
        select.value=selected.get(plan.rowIdx)?.choice||'keep';select.onchange=()=>{confirmation.replaceChildren();if(select.value==='keep')selected.delete(plan.rowIdx);else selected.set(plan.rowIdx,{rowIdx:plan.rowIdx,expectedVersion:plan.expectedVersion,choice:select.value,verifiedOnly:false});count();};label.append(select);card.append(label);
      }
      const prev=node('button','Página anterior'),next=node('button','Página siguiente');prev.type=next.type='button';prev.disabled=page===0;next.disabled=(page+1)*50>=plans.length;prev.onclick=()=>{page--;draw();};next.onclick=()=>{page++;draw();};pager.append(prev,node('span',` Página ${page+1} · ${plans.length} casos `),next);count();
    }
    async function analyze(){status.textContent='Contrastando fechas e IDs con todas las páginas de Calendar…';review=await api('audit');selected.clear();confirmation.replaceChildren();page=0;status.textContent=`${review.conflicts} discrepancias entre día interno y presentación; ${review.dates.filter(p=>p.verified).length} ajustes respaldados, incluidos cambios de formato. No se ha escrito nada.`;draw();}
    open.onclick=()=>{section.hidden=false;section.scrollIntoView({behavior:'smooth',block:'start'});action(analyze);};refresh.onclick=()=>action(analyze);formats.onchange=()=>{search='';rowSearch.value='';page=0;draw();};find.onclick=()=>{search=rowSearch.value;page=0;draw();};
    selectVerified.onclick=()=>{for(const plan of filtered())if(plan.verified&&!selected.has(plan.rowIdx)&&selected.size<450)selected.set(plan.rowIdx,{rowIdx:plan.rowIdx,expectedVersion:plan.expectedVersion,choice:plan.verified,verifiedOnly:true});draw();};
    prepare.onclick=()=>{
      confirmation.replaceChildren();confirmation.append(node('h3','Confirmación de las fechas elegidas'));
      for(const decision of selected.values()){const plan=review.dates.find(p=>p.rowIdx===decision.rowIdx),choice=plan.choices.find(c=>c.key===decision.choice);confirmation.append(node('p',`F${plan.rowIdx}: ${LocaleData.display(plan.internal)||'(texto)'} → ${LocaleData.display(choice.iso)}${plan.internal===choice.iso?' (solo formato)':''}`));}
      const confirm=node('button','Confirmar fechas en la copia'),cancel=node('button','Cancelar selección');confirm.type=cancel.type='button';confirmation.append(confirm,cancel);
      cancel.onclick=()=>{selected.clear();confirmation.replaceChildren();draw();status.textContent='Selección cancelada. Sin cambios.';};
      confirm.onclick=()=>action(async()=>{status.textContent='Aplicando únicamente las fechas seleccionadas y verificando el resultado…';const result=await api('applyDates',{decisions:[...selected.values()]});const saved=`${result.cellsChanged||0} fechas o formatos guardados y verificados. Calendar no cambia.`;try{await analyze();await syncData(false,false);status.textContent=saved;}catch(error){status.textContent=saved+' Falta refrescar el análisis: '+error.message;}});
      confirmation.scrollIntoView({block:'nearest'});
    };
    prepareNumbers.onclick=()=>action(async()=>{
      const data=await api('numbersAudit'),eligible=data.numbers.filter(p=>!p.blocked),blocked=data.numbers.filter(p=>p.blocked);numberResult.replaceChildren();numberResult.append(node('p',`${eligible.length} celdas convertibles o con formato pendiente; ${blocked.length} textos ambiguos quedan sin tocar. Se conservan valores y fórmulas. No se recalculan tarifas.`));
      for(const p of blocked.slice(0,10))numberResult.append(node('p',`${p.kind}, fila ${p.rowIdx}: ${p.shown} · ${p.reason}`));
      const apply=node('button','Confirmar normalización numérica'),cancel=node('button','Cancelar normalización');apply.type=cancel.type='button';numberResult.append(apply,cancel);cancel.onclick=()=>{numberResult.replaceChildren(node('p','Normalización cancelada. Sin cambios.'));};
      apply.onclick=()=>action(async()=>{let changed=0;try{for(let i=0;i<eligible.length;){let end=Math.min(i+450,eligible.length);while(end<eligible.length&&eligible[end].kind===eligible[end-1].kind&&eligible[end].rowIdx===eligible[end-1].rowIdx)end++;const batch=eligible.slice(i,end).map(p=>({kind:p.kind,rowIdx:p.rowIdx,column:p.column,expectedVersion:p.expectedVersion}));const result=await api('applyNumbers',{decisions:batch});changed+=result.cellsChanged||0;i=end;status.textContent=`Normalizadas y verificadas ${changed} celdas…`;}
          numberResult.replaceChildren(node('p',`${changed} celdas normalizadas y verificadas. ${blocked.length} textos ambiguos no se han modificado.`));try{await syncData(false,false);}catch(error){status.textContent=`${changed} celdas guardadas y verificadas. Falta recargar la vista: ${error.message}`;}
        }catch(error){status.textContent=`Se verificaron ${changed} celdas. Se detuvo el resto: ${error.message} Vuelve a revisar los pendientes.`;}});
    });
    check.onclick=()=>action(async()=>{status.textContent='Comprobando números nativos, suma y origen del gráfico en una pestaña temporal…';const result=await api('check');status.textContent=`16,50 + 20,25 = ${result.formatted}. Datos numéricos del gráfico comprobados. Pestaña temporal retirada. Calendar sin cambios.`;});
    count();
  };
})();
