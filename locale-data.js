(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LocaleData=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const EPOCH=Date.UTC(1899,11,30),DAY=86400000;
  function validISO(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';const y=+m[1],month=+m[2],d=+m[3];if(y<1900||y>2100)return '';const dt=new Date(Date.UTC(y,month-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===month-1&&dt.getUTCDate()===d?m[0]:'';}
  function parseSpanish(value){if(validISO(value))return value;const m=String(value||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?validISO(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`):'';}
  function fromSerial(value){if(!Number.isInteger(value))return '';const date=new Date(EPOCH+value*DAY);return Number.isNaN(+date)?'':validISO(date.toISOString().slice(0,10));}
  function serial(iso){if(!validISO(iso))throw new Error('Fecha no válida.');const [y,m,d]=iso.split('-').map(Number);return (Date.UTC(y,m-1,d)-EPOCH)/DAY;}
  function display(iso){if(!validISO(iso))return '';const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;}
  const value=c=>c?.effectiveValue?.numberValue??c?.effectiveValue?.stringValue??c?.effectiveValue?.boolValue??c?.userEnteredValue?.numberValue??c?.userEnteredValue?.stringValue??'';
  function dateISO(cell){const v=value(cell);return typeof v==='number'?fromSerial(v):parseSpanish(v);}
  function numeric(value){if(typeof value==='number')return Number.isFinite(value)?value:null;let s=String(value??'').replace(/€/g,'').replace(/[\s\u00a0]/g,'');if(/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s))s=s.replace(/\./g,'').replace(',','.');else if(/^-?\d+(,\d+)?$/.test(s))s=s.replace(',','.');else if(!/^-?\d+\.\d{1,2}$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
  function time(v){if(typeof v==='number'&&v>=0&&v<1){const minutes=Math.round(v*1440)%1440;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}const m=String(v||'').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);return m&&+m[1]<24&&+m[2]<60?`${m[1].padStart(2,'0')}:${m[2]}`:'';}
  function rowValues(cells,kind='detail'){return cells.map((c,i)=>{
    const raw=value(c);
    if(kind==='detail'&&i===5)return display(dateISO(c));
    if(kind==='detail'&&[12,13].includes(i))return time(raw);
    if((kind==='detail'&&[4,6,7].includes(i))||(kind==='group'&&[2,3].includes(i)))return numeric(raw)??raw;
    if(kind==='detail'&&i<4&&typeof raw==='boolean')return raw?'X':'';
    return raw;
  });}
  function localDate(iso){if(!validISO(iso))return null;const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d);}
  const currency=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n);
  return {validISO,parseSpanish,fromSerial,serial,display,value,dateISO,numeric,time,rowValues,localDate,currency};
});
