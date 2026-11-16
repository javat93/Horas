# Optimización de cuota del repertorio

16/11/2026. El alcance está limitado a Repertorio. No se cambian datos, reglas, automatismos ni servicios de sesiones o Calendar.

## Marcados agrupados

Las casillas Ya lo saben y Repasando actualizan la vista inmediatamente como pendientes. Se acumulan durante 1,2 segundos desde la última pulsación, con una espera máxima de 4 segundos desde la primera. Guardar ahora adelanta el envío. Los lotes contienen hasta 50 relaciones únicas y solo aceptan los dos booleanos; los cambios de una misma relación se combinan y prevalece el último valor de cada casilla. Deshacer hasta el valor confirmado antes de enviar elimina el cambio y no consume cuota. La cola continúa al cambiar de sección o grupo y avisa antes de cerrar con datos sin confirmar. No guarda borradores ni tokens en otro almacenamiento.

Un lote efectivo se aplica mediante un único batchUpdate de Sheets. El servidor valida íntegramente el lote antes de escribir; una relación inexistente o un conflicto aborta el conjunto. Los UUID, notas, relaciones de otros grupos, fechas existentes y reglas previas de marcado se conservan.

## Lecturas y comprobaciones

Antes, un guardado efectivo hacía tres instantáneas, cada una con metadatos y cuadrícula: seis lecturas. Ahora, la primera instantánea sigue leyendo metadatos y cuadrícula (dos lecturas). Las instantáneas inmediatamente anterior y posterior al batchUpdate reutilizan únicamente los límites de rango de esta operación y piden en la misma lectura los datos y metadatos frescos: otras dos lecturas.

El total normal por lote es cuatro lecturas y una escritura. No existe una caché de datos entre usuarios o peticiones. Se comprueban ID de libro, locale, zona horaria, nombres, IDs y dimensiones de las pestañas en cada lectura de cuadrícula. Un cambio de estructura detiene el guardado; no se acepta una lectura truncada. Se mantienen la comparación de versiones antes de escribir y la verificación de datos y fórmulas tras escribir. La política conserva su lista cerrada de rangos y las escrituras limitadas a Temas y GrupoTemas.

## Conflictos, cuota y resultados inciertos

Los marcados permanecen pendientes hasta recibir una respuesta verificada. Un conflicto o respuesta incierta pausa la cola, conserva los marcados y no reintenta escrituras automáticamente. Actualizar y revisar marcados obtiene la versión actual; el usuario revisa y pulsa Guardar marcados. Si la lectura confirma que una escritura cuya respuesta se perdió ya se aplicó, se retira el pendiente sin volver a escribir.

Ante un 429 o mensaje de cuota, la cola espera aproximadamente 60 segundos antes de permitir otra revisión. El aviso muestra que los marcados se conservan. La espera no envía nuevas peticiones por sí sola. Descartar marcados solo retira el borrador local.

El backend anuncia progressBatch y la interfaz mantiene los cambios bloqueados si se encuentra con un despliegue anterior. Los recursos del cliente y la vista tienen una versión nueva para evitar mezclar archivos de caché.

## Coste comprobado en simulación

- Abrir/actualizar: 2 lecturas, sin escrituras; no cambia.
- Un cambio efectivo aislado: pasa de 6 a 4 lecturas, con una escritura.
- Diez cambios dentro de un lote: de 60 lecturas y 10 escrituras a 4 lecturas y una escritura (93,3% menos lecturas).
- Veinte casillas de diez temas dentro de un lote: de 120 lecturas y 20 escrituras a 4 lecturas y una escritura (96,7% menos lecturas).
- Marcar y deshacer antes del envío: cero peticiones de Sheets.

La reducción depende del agrupamiento; otros dispositivos y las operaciones existentes de la app comparten la cuota del usuario. No se ha aumentado la cuota del proyecto. Referencia: https://developers.google.com/workspace/sheets/api/limits

## Validación

270 pruebas aprobadas: lote de diez temas, fórmulas y estados independientes entre grupos, campos rechazados antes de Google, edición externa antes del guardado, metadatos frescos y estructura alterada, verificación posterior incorrecta, respuestas perdidas, caducidad del buffer, división de más de 50 relaciones y error de cuota sin reenvíos.

Navegador con Google simulado: varios marcados y retorno entre secciones, estado pendiente/confirmado, conflicto con conservación del marcado, lectura de revisión y confirmación manual, y deshacer antes de enviar. Diseño móvil comprobado a 320 y 390 px sin desbordamiento horizontal. Sin escrituras de prueba sobre los datos reales de Google.
