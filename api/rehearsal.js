// Perfil fijo del clon: nunca permite elegir la hoja desde el navegador.
// Ensayo autenticado terminado: solo lectura; Realizado automático sigue pausado.
const {createHandler}=require('./test.js');
module.exports=createHandler({profile:'rehearsal',writeEnabled:false,automaticEnabled:false});
