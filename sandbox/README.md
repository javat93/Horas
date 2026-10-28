# Entorno de pruebas — fase 4

La fase 4 lee valores nativos (números, fechas seriales y horas), muestra moneda española y marca las discrepancias de fecha pendientes. La revisión de fechas conserva la distinción entre el día interno y el texto anteriormente mostrado. Propone el cambio respaldado por Calendar solo con ID no compartido, grupo y horario compatibles; nunca intercambia día/mes de todo el histórico. Cada cambio se revisa, se relee la fila y solo escribe F con número serial y formato dd/mm/yyyy. Las fórmulas de fecha no se sustituyen.

La normalización numérica se aplica por lotes de hasta 500 celdas, solo en Detalle E/G/H y Coles C/D. Conserva números y fórmulas; convierte texto solo si no es ambiguo y sin redondear el valor interno. No recalcula precios, no cambia H=1 ni escribe barrios o dirección. La prueba temporal verifica 16,50 + 20,25 = 36,75 y el origen numérico de un gráfico, retirando la pestaña al terminar. La configuración de la copia permanece es_ES y Europe/Madrid. La migración queda registrada en el informe externo de la fase; el original sigue bloqueado.

La fase 2 fue validada por el usuario. La fase 3 añade revisión de precios, importes por sesión, barrios y horarios antes de guardar o sincronizar un mes. Se conserva todo por defecto y se confirma cada grupo de campos por separado. Cancelar no envía escrituras. El endpoint protegido vuelve a leer valores nativos y fórmulas, verifica las versiones de las filas y el catálogo y escribe solo las celdas aceptadas (E/G, J o M/N), en un lote. No escribe A/B/C/D/F/H/I/K/L, no cambia fechas ni Calendar y no permite altas/borrados ni editar grupos todavía.

«Conservar» deja intactos los valores y fórmulas de precio/importe. «Usar propuesta» económica fija explícitamente precio e importe por sesión, sin multiplicar por duración. Un barrio vacío no borra uno manual. Las fórmulas que puedan depender de horario requieren revisar el importe antes de cambiar ese horario. La propuesta del formulario se compara con los datos actuales de Sheets, no con una copia antigua en el navegador. Las comprobaciones previas detectan cambios pero no constituyen una transacción atómica frente a ediciones simultáneas externas.

La fase 1 fue validada por el usuario. En fase 2 se habilita «Revisar vínculos de Calendar»: análisis de IDs compartidos y filas sin ID, consulta de candidatos amarillos con coincidencia exacta de grupo/día/horas en Madrid, lectura de todas las páginas y confirmación por fila. El servicio `api=test?api=links` (ruta real `/api/test?api=links`) permite únicamente modificar K de Detalle en la copia; vuelve a leer la fila y comprueba que el nuevo ID no esté usado por otra. No modifica Calendar ni condiciones económicas. La comprobación previa no es una transacción atómica de Sheets: evitar editar simultáneamente la misma fila mientras se confirma.

Ejemplo de prueba: buscar la fila 1533 (Slap Martes), revisar que su vínculo actual corresponde a Moli, elegir «Dejar sin vincular» y confirmar. Se limpia K1533; K1531 y el evento real permanecen. No se corrige el histórico automáticamente.

Arranque: `npm run start:pruebas` y abrir http://localhost:3000/pruebas .

Comprobaciones automáticas: `npm run test:pruebas`.

El servidor local escucha solo en el equipo local y sustituye el cargador de configuración para usar exclusivamente la copia `1breBD5aoBR4i9yiPJUKZC2Ouk0rvFOlRmwgJk4bUPwI`. La aplicación compartida incorpora las mismas protecciones de modo de pruebas. No se debe desplegar el servidor HTTP local como producción.

Por petición del usuario, GitHub Pages publica ahora la fase 1 con TEST_MODE y la copia como destino. Vercel proporciona `/api/test?api=environment|sheets|calendar|control`; el ID está fijado por código y no depende de la variable SPREADSHEET_ID de los endpoints antiguos. El panel verifica ese destino antes de permitir lecturas autenticadas. Los endpoints antiguos y sus variables de entorno no se han modificado. Para volver a la app habitual habrá que restaurar explícitamente su configuración después de validar las fases.

La página lleva un aviso PRUEBAS, verifica el ID efectivo del backend y utiliza un almacenamiento de token independiente. Al conectar Google solicita Sheets y Calendar de solo lectura. El servidor también rechaza por código cualquier escritura de Calendar, incluso si se presenta un token con permisos más amplios, y todas las escrituras ordinarias de la aplicación. No se ejecuta la actualización automática de Realizado ni la sincronización con efectos secundarios.

El botón «Probar escritura y restauración en la copia» crea una pestaña temporal en la copia, escribe el número 42, lo lee y elimina la pestaña. No escribe en los datos existentes. Si falla la retirada de la pestaña, el mensaje identifica su nombre para poder revisarla. La comprobación real necesita conectar Google desde esta página; las pruebas automáticas usan respuestas simuladas.

Si Google muestra `origin_mismatch`, hay que autorizar `http://localhost:3000` como origen JavaScript en el cliente OAuth indicado por la configuración. Esta fase no cambia la configuración de Google Cloud. No copiar tokens ni claves a archivos o al chat.

Maps se omite durante el aislamiento. Antes de probar cambios de Calendar en una fase posterior habrá que configurar un calendario de pruebas separado: la hoja copiada conserva los IDs de los eventos originales.
