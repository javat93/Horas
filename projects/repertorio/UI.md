# Interfaz de repertorio

Actualizada el 16/11/2026: prioridad móvil (90% del uso), sin seleccionar fechas.

## Uso habitual

Abrir Repertorio desde el menú principal de Horas y elegir el grupo en «Por grupo». Comparte el logo, la navegación y la conexión de Google de la aplicación; no abre otra pantalla ni solicita conectarse de nuevo si la sesión principal sigue vigente.

Se muestran cuatro contadores para el repertorio activo completo:

- Temas del grupo: todos sus temas asignados, sin contar dos veces una versión con varios tipos.
- Ya lo saben: temas con Realizado marcado.
- Aún no lo saben: temas con Realizado desmarcado.
- Repasando: temas con Repasando marcado, tanto aprendidos como pendientes.

Cada tema tiene dos casillas: «Ya lo saben» y «Repasando». Son independientes. Los marcados consecutivos se agrupan durante una breve espera y se muestran como pendientes hasta confirmar el guardado. Guardar ahora adelanta el envío. Se comprueba el resultado antes de mostrarlos como guardados. Un tema ya aprendido puede volver a repasarse por nuevas incorporaciones sin desmarcar lo que el grupo sabe. No se seleccionan ni muestran fechas, último repaso o registro de repasos. Tampoco se solicitan objetivos o motivos.

Los cuatro contadores funcionan como filtros. Sus etiquetas cortas son Temas, Ya saben, Por aprender y En repaso. El botón «Filtros» despliega tipo y archivados; permite restablecerlos. Se pueden combinar con búsqueda y tipo. Los contadores mantienen los totales del grupo aunque se filtre la lista. Un filtro vacío propone cambiar de filtro.

«Añadir temas» permite elegir hasta 50 temas del catálogo. Después se marcan los que ya sabe el grupo. «Archivar» retira una relación conservando sus datos; «Mostrar archivados» permite recuperarla. Las notas son opcionales y se abren desde el menú de opciones del tema; el formulario solo pide la nota. Archivar y recuperar también están en ese menú.

El menú «Opciones del repertorio» permite actualizar datos y seleccionar varios temas. La selección permite «Marcar como repasando» con un clic, sin formulario ni fechas. No cambia la casilla «Ya lo saben». Los lotes se limitan a 50 relaciones.

«Grupos» muestra el resumen y permite abrir su repertorio. «Catálogo de temas» mantiene nombre, orden, tipos Galeta/Slap/Propio, notas generales y archivo recuperable. Cambiar el nombre u orden conserva el TemaID y el seguimiento.

En móvil, el menú inferior principal conserva Lista, Calendario, Grupos y Repertorio. Dentro de Repertorio, Por grupo, Catálogo y Resumen se encuentran arriba. El selector permanece visible al desplazar y el enlace guarda el grupo elegido para recuperarlo al reconectar. Las casillas principales tienen 48 px de alto; los formularios se presentan como paneles inferiores. En escritorio se conserva la navegación superior y una distribución más compacta.

## Datos y límites

La aplicación publicada utiliza el original como único maestro. La columna nativa Realizado representa «Ya lo saben». Se conserva el esquema compatible del libro y de la API, incluidos los campos anteriores que ya no se usan en esta interfaz; no se borran datos existentes ni se ejecuta una migración por esta simplificación. Detalle, sesiones, Calendar y los estados de aprendizaje actuales no se modifican al publicar el cambio.

La interfaz productiva reutiliza la sesión principal y su caducidad, sin pedir otros permisos ni guardar otra sesión. El backend de repertorio comprueba su perfil/destino y continúa sin acceso a Calendar. Se renueva la conexión principal solo cuando caduca o se invalida. El entorno de desarrollo mantiene su acceso aislado. Ver INTEGRATION.md.

Los controles se bloquean durante un guardado. Si hay una edición externa, se conserva el formulario y se pide actualizar antes de guardar. Las respuestas perdidas se verifican antes de reintentar; no hay reenvío automático. Los UUID evitan duplicar altas y asignaciones. Ver API.md para los límites de concurrencia.

La copia de desarrollo permanece como archivo en consulta en http://localhost:3002, con `node sandbox/repertoire-server.cjs` sin --write. El acceso técnico por JSON se conserva en /tecnico. Ver PHASE5.md para el respaldo y la migración ya completada.

## Validación de esta simplificación

249 pruebas automáticas aprobadas. Recorrido en navegador sobre `node sandbox/repertoire-preview.cjs`, http://localhost:3004: contadores, cambio de «Ya lo saben», coexistencia con «Repasando», filtro con y sin resultados, independencia entre grupos, marcado directo de un lote y formulario de notas con cero campos de fecha. Los datos de esta prueba son ficticios en memoria; no se escribieron estados de aprendizaje de prueba en Google Sheets.

La fase 6 añade la revisión responsive de 320 × 568 hasta 1280 × 900; ver PHASE6.md y evidence/phase6.json.

## Guardado agrupado y cuota

El guardado automático acumula marcados durante 1,2 segundos, con espera máxima de 4 segundos y lotes de 50 relaciones. Si hay un conflicto o límite de cuota, conserva los marcados y ofrece Actualizar y revisar marcados antes de Guardar marcados. No hay reenvío automático de escrituras inciertas. Espera a Marcados guardados y verificados antes de cerrar. Ver QUOTA.md y evidence/quota.json.
