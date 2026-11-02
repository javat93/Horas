// Perfil fijo del clon: nunca permite elegir la hoja desde el navegador.
// Primera etapa del ensayo autenticado: solo lectura.
const {createHandler}=require('./test.js');
module.exports=createHandler({profile:'rehearsal',writeEnabled:false,automaticEnabled:false});
