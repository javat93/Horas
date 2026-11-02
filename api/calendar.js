// Compatibilidad de lectura. Las escrituras solo pasan por los revisores protegidos.
// No se reutiliza el proxy genérico anterior ni su destino por variable de entorno.
const protectedTest=require('./test.js');
module.exports=(req,res)=>protectedTest({method:req.method,headers:req.headers,body:req.body,query:{api:'calendar'}},res);
