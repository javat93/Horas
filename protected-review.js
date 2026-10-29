(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProtectedReview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function number(value){
    if(typeof value==='number'){if(Number.isFinite(value)&&value>=0)return Math.round(value*100)/100;throw new Error('Importe no válido.');}
    let s=String(value??'').replace(/€/g,'').replace(/[\s\u00a0]/g,'');
    if(/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');
    else if(/^\d+(,\d{1,2})?$/.test(s))s=s.replace(',','.');
    else if(!/^\d+\.\d{1,2}$/.test(s))throw new Error('Usa un importe como 37,50; no se interpreta un separador ambiguo.');
    const n=Number(s);if(!Number.isFinite(n))throw new Error('Importe no válido.');return Math.round(n*100)/100;
  }
  const text=c=>c?.formattedValue??c?.effectiveValue?.stringValue??c?.userEnteredValue?.stringValue??'';
  function amount(c){try{return number(c?.effectiveValue?.numberValue??c?.effectiveValue?.stringValue??text(c));}catch{return null;}}
  const version=cells=>JSON.stringify(cells.map(c=>[c?.userEnteredValue||{},c?.effectiveValue||{}]));
  function moneyEqual(a,b){return a.price===b.price&&a.total===b.total;}
  function districtEqual(a,b){return String(a??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')===String(b??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');}
  const time=value=>String(value??'').replace(/^(\d):/,'0$1:');
  function makePlan(rowIdx,cells,proposal,source,notes=[]){
    const current={price:amount(cells[4]),total:amount(cells[6]),district:String(text(cells[9])),address:String(text(cells[11])),start:String(text(cells[12])),end:String(text(cells[13]))};
    const next={money:proposal.money||null,district:proposal.district===undefined?null:proposal.district,address:proposal.address===undefined?null:proposal.address,time:proposal.time||null};
    return {rowIdx,group:String(text(cells[8])),date:String(text(cells[5])),current,proposal:next,source,notes,expectedVersion:version(cells),proposalVersion:JSON.stringify(next),hasMoneyFormula:!!(cells[4]?.userEnteredValue?.formulaValue||cells[6]?.userEnteredValue?.formulaValue),diff:{money:!!next.money&&!moneyEqual(current,next.money),district:next.district!==null&&!districtEqual(current.district,next.district),address:next.address!==null&&!districtEqual(current.address,next.address),time:!!next.time&&(time(current.start)!==time(next.time.start)||time(current.end)!==time(next.time.end))}};
  }
  function changes(plan,choices,cells){
    if(!choices||Object.keys(choices).some(k=>!['money','district','address','time'].includes(k)))throw new Error('Decisiones de revisión no válidas.');
    if(choices.address!==undefined&&!['keep','use'].includes(choices.address))throw new Error('Decisión de dirección no válida.');
    for(const field of ['money','district','time'])if(!['keep','use'].includes(choices[field]))throw new Error('Elige conservar o usar propuesta para cada campo.');
    const out=[];
    if(choices.money==='keep'&&((choices.address==='use'&&plan.diff.address)||(choices.district==='use'&&plan.diff.district))){
      const safeFormula=new RegExp('^=\\s*\\$?E\\$?'+plan.rowIdx+'\\s*\\*\\s*\\$?H\\$?'+plan.rowIdx+'\\s*$','i');
      if(cells[4]?.userEnteredValue?.formulaValue||(cells[6]?.userEnteredValue?.formulaValue&&!safeFormula.test(cells[6].userEnteredValue.formulaValue)))throw new Error('El importe usa una fórmula que podría variar con la ubicación. Revisa el importe antes de cambiarla.');
    }
    if(choices.money==='use'&&!plan.proposal.money)throw new Error('No hay una propuesta económica para aceptar.');
    if(choices.money==='use'&&(plan.diff.money||(choices.time==='use'&&plan.diff.time&&plan.hasMoneyFormula))){out.push({column:4,value:{numberValue:number(plan.proposal.money.price)}},{column:6,value:{numberValue:number(plan.proposal.money.total)}});}
    if(choices.district==='use'&&plan.diff.district){if(!String(plan.proposal.district).trim())throw new Error('Una propuesta vacía no puede borrar el barrio.');out.push({column:9,value:{stringValue:plan.proposal.district}});}
    if(choices.address==='use'){
      if(!String(plan.proposal.address??'').trim())throw new Error('Una propuesta vacía no puede borrar la dirección.');
      if(plan.diff.address){
        out.push({column:11,value:{stringValue:plan.proposal.address}});
      }
    }
    if(choices.time==='use'&&plan.diff.time){
      if(choices.money==='keep'){
        const formula=cells[6]?.userEnteredValue?.formulaValue;
        const safeFormula=new RegExp('^=\\s*\\$?E\\$?'+plan.rowIdx+'\\s*\\*\\s*\\$?H\\$?'+plan.rowIdx+'\\s*$','i');
        if(cells[4]?.userEnteredValue?.formulaValue||(formula&&!safeFormula.test(formula)))throw new Error('El importe usa una fórmula que podría variar con el horario. Conserva el horario o revisa el importe antes de cambiarlo.');
      }
      for(const [column,time]of [[12,plan.proposal.time.start],[13,plan.proposal.time.end]]){
        const match=String(time).match(/^(\d{2}):(\d{2})$/);if(!match||+match[1]>23||+match[2]>59)throw new Error('Horario no válido.');
        out.push({column,value:{numberValue:(+match[1]*60 + +match[2])/1440},timeFormat:true});
      }
    }
    return out;
  }
  return {number,text,amount,version,makePlan,changes};
});
