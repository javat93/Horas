document.addEventListener('DOMContentLoaded',()=>{
const open=document.getElementById('reports-open'),close=document.getElementById('reports-close'),dialog=document.getElementById('reports-dialog');
const tabs=[document.getElementById('reports-admin-tab'),document.getElementById('reports-personal-tab')];
function activate(index,focus=false){tabs.forEach((tab,i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;});if(focus)tabs[index].focus();}
open.addEventListener('click',()=>{if(!dialog.open){dialog.showModal();open.setAttribute('aria-expanded','true');}});close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{open.setAttribute('aria-expanded','false');open.focus({preventScroll:true});});
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();activate(event.key==='Home'?0:event.key==='End'?1:1-i,true);}});});activate(0);
});
