# Fase 1: entorno de pruebas

Arranque: `npm run start:pruebas` y abrir http://localhost:3000/pruebas .

Comprobaciones automáticas: `npm run test:pruebas`.

El servidor local escucha solo en el equipo local y sustituye el cargador de configuración para usar exclusivamente la copia `1breBD5aoBR4i9yiPJUKZC2Ouk0rvFOlRmwgJk4bUPwI`. La aplicación compartida incorpora las mismas protecciones de modo de pruebas. No se debe desplegar el servidor HTTP local como producción.

Por petición del usuario, GitHub Pages publica ahora la fase 1 con TEST_MODE y la copia como destino. Vercel proporciona `/api/test?api=environment|sheets|calendar|control`; el ID está fijado por código y no depende de la variable SPREADSHEET_ID de los endpoints antiguos. El panel verifica ese destino antes de permitir lecturas autenticadas. Los endpoints antiguos y sus variables de entorno no se han modificado. Para volver a la app habitual habrá que restaurar explícitamente su configuración después de validar las fases.

La página lleva un aviso PRUEBAS, verifica el ID efectivo del backend y utiliza un almacenamiento de token independiente. Al conectar Google solicita Sheets y Calendar de solo lectura. El servidor también rechaza por código cualquier escritura de Calendar, incluso si se presenta un token con permisos más amplios, y todas las escrituras ordinarias de la aplicación. No se ejecuta la actualización automática de Realizado ni la sincronización con efectos secundarios.

El botón «Probar escritura y restauración en la copia» crea una pestaña temporal en la copia, escribe el número 42, lo lee y elimina la pestaña. No escribe en los datos existentes. Si falla la retirada de la pestaña, el mensaje identifica su nombre para poder revisarla. La comprobación real necesita conectar Google desde esta página; las pruebas automáticas usan respuestas simuladas.

Si Google muestra `origin_mismatch`, hay que autorizar `http://localhost:3000` como origen JavaScript en el cliente OAuth indicado por la configuración. Esta fase no cambia la configuración de Google Cloud. No copiar tokens ni claves a archivos o al chat.

Maps se omite durante el aislamiento. Antes de probar cambios de Calendar en una fase posterior habrá que configurar un calendario de pruebas separado: la hoja copiada conserva los IDs de los eventos originales.
