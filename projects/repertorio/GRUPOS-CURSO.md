# Organización de grupos por curso

Publicación: 16/11/2026. La organización se comparte entre Grupos y Repertorio y reutiliza la sesión principal de Google.

## Uso

- Curso escolar de septiembre a agosto, calculado con la zona Europe/Madrid.
- Vista inicial: curso actual, activos, habituales, por orden alfabético español.
- Estado: activos, inactivos, sin clasificar o todos. Tipo: habitual, puntual o todos.
- Un grupo puntual también puede estar activo. La clasificación pertenece a un curso, no a la ficha histórica del grupo.
- Los grupos existentes empiezan sin clasificar; no se infiere actividad desde las sesiones ni desde los temas asignados.
- Organizar este curso permite buscar, seleccionar varios, ajustar estado y tipo y guardar hasta 100 grupos en un lote.
- Copiar del curso anterior prepara una selección conservando estado y tipo. Omite los grupos ya clasificados en el destino y exige revisión y guardado explícitos. Los grupos puntuales también se muestran para su revisión.
- Inactivar no elimina el grupo, su repertorio ni sus registros históricos. El repertorio aprendido se conserva entre cursos.
- Los filtros se comparten en memoria durante la visita; al recargar se recupera la vista inicial del curso actual.

## Datos y límites

Única pestaña nueva: `GruposCurso`, ID 155111503, en el libro original `1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60`.

Columnas A:F: IdGrupo, Grupo, Curso, Activo, Tipo, ActualizadoEn. Clave única: identidad canónica de grupo + curso. Se conservan los alias ya definidos por GroupIdentity.

El endpoint `/api/grupos-curso` acepta `load` y `save`. `save` recibe curso, updates (grupo/activo/tipo) y expectedVersion. Solo escribe valores en filas de GruposCurso. Lee únicamente Coles!A y GruposCurso!A:F; no accede a Detalle, tarifas, sesiones, Temas, GrupoTemas ni Calendar. La cuadrícula y cabeceras se comprueban en cada operación.

La pestaña tiene 1.000 filas de datos, filtros, cabecera inmovilizada y validación de booleanos/tipo. Las filas de plantilla con casilla Activo=false se consideran vacías hasta tener clasificación. Al llenarse la plantilla, la app informa y no amplía ni modifica otras pestañas.

## Cuota y guardado

- La organización se carga al entrar por primera vez en Grupos/Repertorio, no al abrir Lista.
- Una carga compartida = 2 lecturas. Las cargas simultáneas se deduplican.
- Cambiar grupo, filtros, curso o pantalla usa la caché de la visita, sin lecturas adicionales.
- Un lote de hasta 100 grupos = 4 lecturas + 1 escritura; conserva comprobación previa y relectura posterior.
- Un guardado sin cambios = 2 lecturas, sin escritura.
- Los conflictos, errores de cuota y respuestas inciertas conservan la selección. Exigen actualizar, revisar y guardar explícitamente; nunca reenvían escrituras de forma automática.
- La cuota detiene la actualización durante un minuto. El temporizador solo habilita el botón; no hace peticiones.
- La renovación de sesión y Actualizar organización invalidan la caché; no se almacenan nuevos tokens ni datos personales en localStorage.
- La organización no puede editarse mientras hay marcados de repertorio pendientes de guardar.

## Validación y despliegue

Pruebas de cambio de curso en Madrid, filtros, alias, copia conservadora, lotes de 100, límites, payloads manipulados, conflictos, cambios de estructura, respuesta perdida y verificación posterior. Pruebas de interfaz en simulación local sin acceso a Google. Ninguna prueba escribe sesiones ni Calendar.

Copia de seguridad previa: https://docs.google.com/spreadsheets/d/1pktgJFyES_YMfVizuM-xkP-ax9r0fijvbSoIwM7AKZg/edit

La instalación solo añadió GruposCurso. No se modificaron las ocho pestañas anteriores ni se clasificaron grupos reales automáticamente. Para retirar esta función basta volver a la publicación anterior; la pestaña independiente puede conservarse como archivo sin afectar a la aplicación anterior.
