# Interfaz de repertorio

Estado actual desde el 15/11/2026: [Repertorio publicado](https://javat93.github.io/Horas/repertorio.html), conectado al original, con lectura y escritura verificadas. El acceso aparece en la navegación de Horas y abre el dominio autorizado también desde la copia local de la app. La sesión del módulo pide solo Sheets y conserva el aislamiento de Calendar. Desarrollo se mantiene en consulta como archivo. Ver PHASE5.md. Las instrucciones de la fase 3 que siguen describen el entorno de desarrollo histórico.

Implementada el 15/11/2026. Funciona con el modelo y la API de la fase 2; el destino del servidor permanece fijado a la copia de desarrollo. No se han modificado index.html, las operaciones de sesiones, Detalle, Coles ni el libro original.

## Abrir la interfaz

Desde C:\Users\Javat\Documents\GitHub\Horas-repertorio:

```powershell
node sandbox/repertoire-server.cjs --write
```

Abrir http://localhost:3002 y pulsar «Conectar Google». El distintivo DESARROLLO y el enlace «Abrir copia de desarrollo» permiten identificar el entorno. Sin --write se ofrece consulta. El acceso técnico anterior está en /tecnico.

El cliente comprueba el destino y las capacidades antes de habilitar la conexión. No comparte tokens con la aplicación habitual ni los guarda de forma persistente. El SDK y el cliente OAuth se preparan antes del clic; la ventana de acceso se abre dentro del gesto del usuario. El inicio de sesión real desde http://localhost:3002 se validó en Chrome el 15/11/2026, con los dos grupos piloto, guardado reversible y conflicto con una edición externa de Sheets. Ver PILOT.md. La configuración de Google Cloud no se cambió mediante automatización.

## Catálogo de temas

- «Nuevo tema»: introducir nombre, entero positivo de orden y una o varias casillas Galeta, Slap y Propio.
- Se pueden repetir números entre tipos distintos; compartir un tipo con otro tema activo del mismo número produce un aviso y mantiene el formulario.
- Las notas generales pertenecen al tema y son comunes a sus grupos.
- «Editar» conserva el ID del tema, así que cambiar nombre u orden no pierde el seguimiento.
- «Archivar» conserva sus relaciones. «Mostrar archivados» permite recuperarlo; al recuperar se valida de nuevo el orden.
- Buscar por nombre y filtrar por tipo. El número de grupos cuenta identidades de grupo únicas.

## Grupos y repertorio

«Grupos» muestra el catálogo de la copia en consulta, con sus contadores y acceso «Ver repertorio». También se puede cambiar de grupo desde el selector de «Por grupo».

«Añadir temas» permite elegir hasta 50 temas activos, buscar y filtrar por tipo. Cada tema se asigna una vez al grupo. Las relaciones nuevas empiezan pendientes; al seleccionar una relación archivada se recuperan sus estados y notas.

En cada tema:

- Realizado y Repasando son casillas independientes. Marcar Repasando conserva Realizado y la fecha del último repaso.
- «Registrar repaso» pide una fecha, propuesta según Madrid, y solo actualiza Último repaso. También se puede registrar un lote mediante selección de temas.
- «Detalles» permite editar fechas, próximo objetivo, motivo y notas particulares del grupo. Se envían solo los campos modificados.
- «Archivar» retira la relación de la vista habitual conservando sus datos; «Mostrar archivados» permite recuperarla.

Se pueden combinar búsqueda, tipo y estado: Todos, Pendientes, Realizados o Repasando. Los contadores reflejan el repertorio activo del grupo completo, aunque se esté filtrando la lista. Los temas con varios tipos cuentan una sola vez.

Seleccionar temas habilita «Marcar para repasar» y «Registrar repaso». El formulario de lote explica sus efectos antes de guardar. «Seleccionar visibles» solo afecta a los temas del filtro actual; los cambios de filtro o grupo limpian la selección. Los lotes se limitan a 50 relaciones.

## Guardados y recuperación

Los controles de escritura se deshabilitan durante la operación. La interfaz muestra el resultado después de que la API haya verificado la relectura. No repite escrituras automáticamente.

- Si los datos han cambiado, se conserva el formulario y se ofrece «Actualizar y conservar formulario». Tras recargar, revisar los campos antes de volver a guardar.
- Si la respuesta se pierde, el guardado queda pendiente de comprobar. Se bloquean nuevos cambios hasta actualizar; los UUID del formulario de alta/asignación se conservan para evitar duplicaciones al reintentar.
- Si solo hay un error de validación, se puede corregir el formulario directamente.
- Al cerrar un formulario modificado se pide descartar los cambios. También se avisa al cerrar la página con cambios o un guardado en curso.
- Las incidencias de la hoja se presentan con pestaña/fila cuando están disponibles y bloquean los guardados hasta revisarlas.

La protección frente a cambios simultáneos conserva los límites documentados en API.md: no es una transacción distribuida de Sheets.

## Simulación de pruebas

```powershell
node sandbox/repertoire-preview.cjs
```

Abrir http://localhost:3004 y pulsar «Abrir simulación». El distintivo SIMULACIÓN y el aviso indican que todos los datos son ficticios y permanecen en memoria. Este servidor sustituye el transporte de Google por una fixture; no lee ni escribe ningún libro real. Al detenerlo se descartan los cambios.

El servidor de desarrollo no expone los endpoints de sesión o control de esta simulación. No se puede activar mediante parámetros de URL o del formulario. Su uso es solo para QA, no para dar por validado un inicio de sesión OAuth real.

## Pendiente para el piloto

Conectar Google desde el origen autorizado, cargar el catálogo real y revisar un grupo con el usuario. La migración al original sigue siendo la fase 5 y está sin ejecutar.
