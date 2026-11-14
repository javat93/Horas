# PercuManager · Repertorio por grupo

Propuesta funcional y técnica · 14/11/2026. Documento de diseño previo a la preparación del proyecto; para el estado actual y el orden de ejecución prevalecen README.md, PHASES.md y MIGRATION.md de esta carpeta.

## 1. Decisiones del diseño

- **Detalle permanece intacta:** sin columnas nuevas, escrituras, relaciones con sus filas ni cambios en su ciclo de altas, edición, sincronización, archivo o restauración.
- No se registran alumnos, listas de asistencia, matrículas ni composición de las clases.
- Se añaden dos pestañas independientes al libro actual: **Temas** y **GrupoTemas**.
- Un tema tiene `Nombre`, `NumeroOrden`, `TemaGaleta`, `TemaSlap` y `TemaPropio`. Las tres últimas propiedades son booleanos independientes.
- Cada fila de GrupoTemas representa **un grupo + un tema**. Los grupos siguen procediendo de Coles, que se consulta sin modificarla.
- `Realizado` y `Repasando` son independientes. Un tema puede estar realizado y necesitar repaso por nuevas incorporaciones.
- El estado de ejecución se registra en README.md. El diseño por sí solo no activa cambios en producción.

## 2. Cómo resuelve el problema

Ejemplo ilustrativo: un grupo tiene un tema marcado como realizado. Se incorporan personas nuevas y necesitas volver a trabajarlo. Abres el repertorio de ese grupo, marcas Repasando, eliges opcionalmente el motivo «Nuevas incorporaciones» y escribes «Revisar entrada y corte final».

Realizado sigue marcado. Cuando el grupo vuelve a tocarlo con seguridad, desmarcas Repasando. Así distingues lo que el grupo ya ha trabajado de lo que toca reforzar ahora, sin gestionar personas ni reiniciar el repertorio entero.

Interpretación de las cuatro combinaciones:

- Realizado = no; Repasando = no: **Pendiente**. Todavía no lo das por realizado; las notas pueden indicar que se ha empezado.
- Realizado = no; Repasando = sí: **Repasando para completar**. Se ha trabajado algo, pero todavía no lo das por realizado.
- Realizado = sí; Repasando = no: **Realizado**.
- Realizado = sí; Repasando = sí: **Realizado · En repaso**.

«Realizado» significa que tú has dado el tema por trabajado/aprendido con ese grupo. No equivale automáticamente a «apto para actuar» ni al campo Realizado de una sesión de Detalle. El paso del tiempo y las sincronizaciones de Calendar no cambian estos indicadores.

No tener una fila en GrupoTemas significa **sin asignar**, no pendiente. Asignar un tema crea una fila pendiente; no implica que ese grupo ya lo conozca.

## 3. Cambios en la aplicación

### 3.1. Catálogo de temas

Nueva sección «Repertorio», con dos vistas: «Por grupo» y «Catálogo de temas».

En el catálogo:

- Crear y editar nombre, número de orden y las tres casillas de tipo.
- Buscar por nombre y filtrar Galeta, Slap o Propio.
- Ver en cuántos grupos se utiliza cada tema y abrir esos grupos.
- Archivar un tema para retirarlo de las nuevas asignaciones conservando el seguimiento existente.
- Ordenar por tipo y número. Se puede escribir el número directamente; arrastrar para reordenar se deja para una ampliación.

Un cambio de nombre o número se refleja en todos los grupos porque se relacionan mediante TemaID. No se copian tres catálogos independientes.

### 3.2. Repertorio de un grupo

Desde «Grupos», añadir un botón «Ver repertorio», además de permitir elegir el grupo dentro de la nueva sección.

Cada fila muestra tipo, número, nombre, Realizado, Repasando, último repaso y próximo objetivo. Las notas y el motivo se abren al desplegar la fila para mantener cómoda la vista móvil.

Acciones:

1. **Añadir temas:** seleccionar varios del catálogo o una lista por tipo. Se crean pendientes, con ambos booleanos a falso.
2. **Marcar realizado:** solo afecta a ese grupo y ese tema.
3. **Activar repaso:** conserva Realizado. Motivo opcional: nuevas incorporaciones, falta de práctica, dificultad concreta u otro.
4. **Registrar repaso de hoy:** actualiza Último repaso; activar la casilla Repasando por sí solo no afirma que ya se haya ensayado.
5. **Cerrar repaso:** desmarca Repasando. No cambia Realizado.
6. **Seleccionar varios → Marcar para repaso:** útil cuando el grupo necesita recuperar varios temas. Se enseña qué filas se van a cambiar y se ofrece deshacer el lote durante la vista actual. Deshacer envía los valores anteriores con las versiones posteriores al guardado; si alguien ha vuelto a editarlos, se pide revisar el conflicto.
7. **Retirar del repertorio:** archiva la relación; al recuperarla conserva su estado anterior.

Filtros: todos, pendientes, realizados y repasando; además de tipo y búsqueda. Los filtros son combinables: Realizado + Repasando permite localizar precisamente los temas conocidos que hay que recuperar.

Encabezado sugerido: «12 asignados · 8 realizados · 3 en repaso». Los contadores pueden solaparse y cada tema se cuenta una sola vez, aunque tenga varios tipos.

El objetivo para la próxima clase se escribe en Próximo objetivo. Es una nota del repertorio del grupo y no crea ni modifica una sesión.

### 3.3. Vista general

Una vista de consulta permite comparar grupos: filas de temas, columnas de grupos, estado resumido en cada celda. Al pulsar una celda se abre su seguimiento. En móvil se prioriza la lista por grupo.

La primera versión puede entregar solo catálogo + lista por grupo; la matriz es una mejora posterior y se calcula a partir de las mismas dos pestañas.

## 4. Pestaña Temas

Una fila por tema del catálogo. Columnas propuestas, en este orden:

```text
A TemaID
B Nombre
C NumeroOrden
D TemaGaleta
E TemaSlap
F TemaPropio
G Activo
H Notas
```

- **TemaID:** UUID generado al crear, inmutable, protegido y normalmente oculto. El número de fila y el orden musical no identifican el tema.
- **Nombre:** texto obligatorio; se recomienda advertir de nombres iguales, permitiendo versiones distintas si se nombran claramente.
- **NumeroOrden:** entero positivo. Es el orden dentro de los tipos seleccionados.
- **TemaGaleta / TemaSlap / TemaPropio:** booleanos nativos, con casillas de verificación; se admiten varias casillas marcadas. Un borrador sin tipo puede guardarse como inactivo; para activarlo se propone exigir al menos un tipo.
- **Activo:** booleano, para archivar sin perder las relaciones.
- **Notas:** texto opcional sobre el tema, compartido por todos los grupos.

### Regla del número de orden

Se permite Galeta 1, Slap 1 y Propio 1 porque pertenecen a tipos distintos. Para evitar ambigüedad, se propone impedir dos temas activos con el mismo número dentro de un mismo tipo.

Si un tema tiene Galeta y Propio marcados, su número se aplica en ambas listas y reserva esa posición en ambas. No se convierten los booleanos en un selector exclusivo.

Ejemplo: un tema Galeta+Propio con orden 2 puede convivir con Slap 2; entra en conflicto con otro Galeta 2 o Propio 2.

Formalmente, dos temas activos entran en conflicto cuando tienen el mismo NumeroOrden y comparten al menos un tipo marcado. Archivar libera esa posición; al reactivar se vuelve a comprobar. Cambiar de tipo u orden también valida el catálogo completo afectado.

La vista «Todos» se agrupa por tipo para que los órdenes repetidos tengan sentido. En una lista combinada sin secciones, se ordena por número, nombre y TemaID como desempate. Un tema con varios tipos se deduplica por TemaID en resultados y contadores.

Si más adelante necesitas que el mismo tema sea Galeta 2 y Propio 5, se ampliaría a un orden por tipo. La versión inicial mantiene el único número que has indicado.

## 5. Pestaña GrupoTemas

Una fila por relación entre un grupo y un tema. Nunca guardar varios temas separados por comas en una celda.

```text
A VinculoID
B Grupo
C TemaID
D NombreTema
E Realizado
F Repasando
G FechaRealizado
H UltimoRepaso
I ProximoObjetivo
J MotivoRepaso
K Notas
L ActualizadoEn
M Activo
```

- **VinculoID:** UUID inmutable de la relación, protegido y normalmente oculto.
- **Grupo:** nombre del catálogo Coles, mediante desplegable. Es la única referencia a los datos anteriores; Coles se lee, no se escribe.
- **TemaID:** referencia a Temas. La app muestra un selector por nombre, tipo y orden; el usuario no necesita escribir UUID.
- **NombreTema:** columna de consulta, mediante búsqueda por TemaID. No es un segundo nombre editable. Una fórmula de búsqueda compatible con la hoja actual se comprobará en el clon antes de fijarla.
- **Realizado / Repasando:** casillas booleanas independientes; las cuatro combinaciones son válidas.
- **FechaRealizado:** fecha opcional de la declaración de realizado; si se carga un estado antiguo sin fecha conocida queda vacía. La app propone hoy al marcarlo y permite corregirlo.
- **UltimoRepaso:** fecha opcional del último repaso realmente registrado. No se rellena automáticamente al activar Repasando.
- **ProximoObjetivo:** texto breve, por ejemplo «Entrada y corte final».
- **MotivoRepaso:** texto opcional con sugerencias. No exige datos personales.
- **Notas:** observaciones específicas de este grupo, independientes de las notas generales del tema.
- **ActualizadoEn:** fecha/hora técnica del último guardado desde la app. Una edición directa en Sheets puede no actualizarla: no se usará como única prueba de versión ni como registro de auditoría.
- **Activo:** permite retirar y recuperar la relación sin perder sus valores.

El nombre, orden y tipos del tema pertenecen a Temas. No se mantienen copias editables en cada grupo. Si se desean columnas de tipo y orden en GrupoTemas para filtrar directamente en Excel, se añaden como columnas de consulta calculadas, sin cambiar el modelo.

### Reglas de integridad

- Una sola relación por grupo lógico + TemaID, incluyendo las archivadas; reasignar recupera la relación existente.
- El mismo tema puede tener estados diferentes en todos los grupos.
- Al asignar una lista a otro grupo se copian las asignaciones seleccionadas, con estados pendientes. No se copia el aprendizaje de otro grupo.
- Grupo debe corresponder de manera inequívoca a Coles. Se reutiliza la normalización y los alias de `group-identity.js` para no separar identidades ya reconocidas, como Molí/Tramuntana.
- El identificador derivado de un nombre no es estable frente a cualquier renombrado futuro. Si se renombra un grupo fuera de los alias conocidos, se ofrece una revinculación explícita de sus filas de GrupoTemas al nuevo nombre, conservando VinculoID y estados. No se modifica Detalle ni se interpreta el cambio como un grupo nuevo automáticamente.
- No se borran físicamente temas usados o relaciones con seguimiento desde la interfaz habitual.
- En la vista actual se distinguen los temas archivados del catálogo de las relaciones archivadas. Los archivados quedan fuera de los contadores habituales, pero siguen disponibles al consultar el histórico conservado.

## 6. Uso directo de la hoja y exportación a Excel

La aplicación actual trabaja con Google Sheets. «Excel» se mantiene como el mismo libro conectado a la app; no se introduce un segundo archivo maestro.

Las dos pestañas permiten filtrar, consultar y editar casillas/notas desde Sheets. Se congelan cabeceras, se activan filtros y se añaden desplegables y validaciones. IDs y fórmulas de consulta se protegen; la protección evita accidentes, no sustituye la validación del servidor.

Para una primera versión fiable, las altas de temas, las asignaciones y los cambios de grupo se hacen desde la app, que genera IDs y comprueba duplicados. Si se introduce manualmente una fila nueva sin ID, se presenta como pendiente de validar/importar; no se inventan vínculos silenciosamente.

Antes de guardar desde la app se releen los valores actuales de las filas afectadas. Una edición directa de casillas o notas invalida la versión que tenía abierta la app y obliga a recargar si hay conflicto. Si las casillas se editan directamente, las fechas se actualizan manualmente: no se añaden automatismos ocultos a Sheets.

Un .xlsx descargado será una exportación de consulta/edición fuera de línea, sin sincronización bidireccional automática. Una importación futura requeriría revisión por IDs y conflictos. Los booleanos se conservan como datos aunque las casillas visuales necesiten adaptación al formato de Excel.

## 7. Diseño técnico ajustado al repositorio actual

### Base inspeccionada

Se revisó el código local de `C:\Users\Javat\Documents\GitHub\Horas`, no el contenido en vivo del libro ni el despliegue productivo. La app tiene un frontend principalmente en index.html, servicios CommonJS, perfiles protegidos y acceso a Sheets desde el backend. Coles se lee como catálogo de grupos. No se identificó un módulo de repertorio en las rutas revisadas.

Hay cambios locales previos en el repositorio. Esta propuesta se entrega fuera de él y no los modifica.

### Módulos propuestos

- `repertoire-model.js`: validación de temas, tipos y órdenes; estados derivados; filtros, contadores y claves de relación. Funciones sin acceso a Google, utilizables en navegador y pruebas.
- `repertoire-ui.js`: catálogo y seguimiento por grupo, con carga diferida al abrir Repertorio. No reescribir el monolito completo para añadir la funcionalidad.
- `sandbox/repertoire-service.cjs`: lectura/escritura limitada a las dos pestañas nuevas, con lectura del catálogo Coles y validación de referencias.
- `api/test.js`: añadir el dominio `api=repertorio` al despachador protegido compartido por los perfiles existentes.
- `sandbox/protected-runtime.cjs`: declarar las nuevas acciones de lectura para que puedan funcionar con el perfil en solo lectura; mantener las escrituras sujetas al perfil y la activación del módulo.
- `sandbox/server.cjs`: exponer el mismo módulo en el entorno local de pruebas.
- `app-data.js`: revisar la clasificación de las nuevas acciones para que los guardados usen la barrera de escritura existente. La barrera del navegador no se considera un bloqueo global.
- Configuración y versión de la app: capacidad `repertorioEnabled` para habilitar la nueva sección por perfil y retirar su escritura de forma independiente si hace falta.

La integración en index.html se limita a la navegación, carga del nuevo módulo y acceso desde una tarjeta de grupo. No se modifican las funciones de lectura/escritura de sesiones para añadir repertorio.

### Contrato de servicio propuesto

Se mantienen los endpoints de perfil existentes y se añade `api=repertorio`. No se acepta un perfil o libro arbitrario desde el navegador.

Acciones de consulta: `catalog`, `groupRepertoire`, `validate`.

Acciones de escritura: `saveTheme`, `assignThemes`, `updateProgress`, `markForReview`, `archiveAssignment`, `archiveTheme` y sus correspondientes restauraciones.

Ejemplo conceptual, no implementado:

```json
{
  "action": "updateProgress",
  "operationId": "UUID-generado-una-sola-vez-para-este-guardado",
  "vinculoId": "UUID-de-la-relacion",
  "expectedVersion": "huella-de-los-valores-leidos",
  "changes": {
    "repasando": true,
    "motivoRepaso": "Nuevas incorporaciones",
    "proximoObjetivo": "Revisar entrada y corte final"
  }
}
```

El servidor aplica solo los campos presentes. Este ejemplo no modifica Realizado ni afirma que hoy se haya realizado un repaso.

### Guardado y concurrencia

1. Validar sesión de Google, perfil y capacidad de escritura del módulo.
2. Resolver las dos nuevas pestañas por metadatos; verificar cabeceras y versión del esquema. No confiar en rangos ni sheetId enviados por el cliente.
3. Localizar la fila por TemaID o VinculoID, nunca por su posición guardada en el navegador.
4. Releer los valores de las filas y catálogos necesarios; comprobar expectedVersion y referencias. Para número/tipos se valida también el conjunto de posiciones afectadas, no solo la fila del tema.
5. Validar tipos estrictos: booleanos reales, enteros positivos, fechas válidas y longitudes de texto. Guardar notas como texto literal para que no se ejecuten como fórmulas.
6. Escribir únicamente las celdas permitidas de Temas o GrupoTemas y releer para comprobar el resultado.
7. Si la respuesta es incierta, consultar el estado antes de repetir. Una operación no verificada se muestra como pendiente de comprobar.

La primera versión puede actualizar filas existentes de forma idempotente fijando los valores finales. Para altas, el UUID de entidad se genera una vez y se reutiliza al reintentar; el servidor busca ese ID antes de crear. La asignación se concilia además por grupo + TemaID. Los lotes reutilizan IDs por relación.

Esto evita duplicaciones por reintentos ordinarios, pero una relectura con huella no proporciona exclusión atómica entre escritores simultáneos. Un bloqueo en memoria tampoco cubre varias instancias del backend ni ediciones directas de Sheets. El alcance inicial es el uso personal actual: detección de conflictos, verificación y aviso de duplicados. Si se exige edición concurrente con garantías estrictas, se añadiría un coordinador persistente o una base transaccional; no se atribuye esa garantía a Sheets.

La lista permitida de escrituras del módulo incluye exclusivamente Temas y GrupoTemas. Ninguna acción de repertorio llama a Calendar o escribe en Detalle o Coles. No se solicitan nuevos permisos de Calendar para este módulo.

## 8. Puesta en marcha

1. Preparar el módulo y un libro clonado con las dos pestañas nuevas. Validar antes si ya existen pestañas con esos nombres.
2. Cargar el catálogo inicial de temas con sus propiedades y órdenes. No deducir repertorio ni estados a partir de sesiones antiguas.
3. Elegir un grupo piloto, asignarle temas y marcar manualmente lo que realmente sabes de su estado actual.
4. Probar el caso central: Realizado → activar Repasando por nuevas incorporaciones → registrar un repaso → cerrar Repasando, conservando Realizado.
5. Comprobar el funcionamiento de los perfiles y que las operaciones del módulo no cambian ninguna celda de las pestañas anteriores ni Calendar.
6. Revisar el resultado antes de activar el módulo en el libro real. La migración solo crea y rellena las pestañas nuevas; no se ejecuta automáticamente al cargar la página.

Para retirar la funcionalidad basta con desactivar su capacidad en el backend y ocultar la sección. Las pestañas nuevas pueden conservarse como respaldo.

## 9. Criterios de aceptación

1. Galeta 1, Slap 1 y Propio 1 se guardan sin conflicto; dos Galeta 1 activos producen un aviso de conflicto y no se aplican desde la app.
2. Un tema Galeta+Propio mantiene ambas propiedades y valida su posición en ambas listas.
3. Un tema realizado para un grupo permanece pendiente o sin asignar en otro.
4. Realizado y Repasando pueden estar activados a la vez; cerrar el repaso conserva Realizado.
5. Marcar Repasando no actualiza Último repaso; «Registrar repaso de hoy» sí lo hace.
6. Cambiar nombre u orden del tema conserva todas sus relaciones y estados.
7. Ordenar las filas completas de las nuevas pestañas no rompe los vínculos; ordenar solo una columna de una tabla se bloquea o se evita mediante protección y vistas de filtro.
8. Un guardado con datos antiguos detecta una edición externa y ofrece recargar; un reintento no duplica una asignación ya verificada.
9. Un tema con varios tipos cuenta una sola vez por grupo; los contadores de realizado y repaso pueden solaparse.
10. Las acciones del módulo escriben exclusivamente en Temas y GrupoTemas. Se comprueba con el cliente Google simulado y comparando una copia del libro antes/después del piloto.
11. No se crean campos ni registros de alumnos, asistencias o composición de clases.

Estas son pruebas a implementar con el módulo, no resultados de pruebas ya ejecutadas.

## 10. Alcance recomendado

**Primera versión:** dos pestañas, catálogo, asignación múltiple, seguimiento por grupo, las dos casillas independientes, notas, fechas explícitas, filtros, archivo y protección de guardados.

**Después, si aporta utilidad:** matriz comparativa y una tercera pestaña HistorialRepertorio para registrar cada cambio o cada repaso. La primera versión conserva el estado y la última fecha; no pretende reconstruir todos los repasos anteriores ni todas las transiciones.

No hace falta seguimiento individual para resolver el problema que has descrito.
