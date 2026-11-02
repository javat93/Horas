// Perfil fijo del clon: nunca permite elegir la hoja desde el navegador.
// Operaciones manuales del ensayo autenticado; Realizado automático sigue pausado.
const {createHandler}=require('./test.js');
module.exports=createHandler({profile:'rehearsal',writeEnabled:true,automaticEnabled:false});
