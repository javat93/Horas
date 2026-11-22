document.addEventListener('DOMContentLoaded',()=>{
 const course=document.getElementById('report-course'),group=document.getElementById('report-group');
 function populate(){const selected=group.value,selectedCourse=course.value||'all';group.replaceChildren(new Option('Todos los grupos',''));for(const o of document.getElementById('filter-grupo').options)if(o.value)group.append(new Option(o.textContent,o.value));group.value=[...group.options].some(o=>o.value===selected)?selected:'';const years=new Set([GroupCourses.currentCourse()]);for(const e of eventos){const d=LocaleData.parseSpanish(e.fechaStr);if(d){const y=Number(d.slice(0,4))-(Number(d.slice(5,7))<9?1:0);years.add(y+'–'+(y+1));}}course.replaceChildren(new Option('Todo el histórico','all'));for(const y of [...years].sort().reverse())course.append(new Option(y,y));course.value=years.has(selectedCourse)?selectedCourse:'all';}
 window.horasReportScope=()=>({curso:course.value||'all',grupo:group.value});
 const rows=()=>ReportTools.filterSessions(eventos,window.horasReportScope(),LocaleData.parseSpanish,GroupIdentity.id);
 function exportSessions(){ReportTools.download('sesiones-'+course.value+'.csv',['Grupo','Fecha','Inicio','Fin','Importe','Cobro','Realizado'],rows().map(e=>[GroupIdentity.label(e.grupo,LocaleData.parseSpanish(e.fechaStr)),e.fechaStr,e.horaInicio,e.horaFin,e.amountWarning?'Importe pendiente de revisar':e.total,e.pagado?'Cobrado':'Pendiente',e.realizado?'Sí':'No']));}
 course.onchange=group.onchange=()=>updateFinancialStats();document.getElementById('report-export').onclick=exportSessions;
 document.addEventListener('horas:data-rendered',populate);populate();
});
