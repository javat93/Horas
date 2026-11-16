# API de repertorio · Fase 2

Implementada el 15/11/2026 en feature/repertorio-grupos. Destino único: la copia de desarrollo fijada en sandbox/repertoire-policy.cjs. No utiliza los perfiles ni los endpoints de sesiones de la app actual.

## Arranque local

Desde C:\Users\Javat\Documents\GitHub\Horas-repertorio:

```powershell
# Solo lectura, por defecto
node sandbox/repertoire-server.cjs

# Lectura y escritura exclusivamente de repertorio en la copia
node sandbox/repertoire-server.cjs --write
```

Abrir http://localhost:3002. También existen npm run start:repertorio y npm run test:repertorio cuando npm está disponible. No hay dependencias nuevas para el módulo; bastan Node y los archivos del repositorio.

El servidor escucha únicamente en 127.0.0.1. No sirve index.html, archivos del repositorio ni endpoints de sesiones o Calendar. No se ha desplegado el endpoint remoto.

La interfaz de fase 3 está en la raíz. El acceso técnico por JSON se conserva en /tecnico. Ambos muestran DESARROLLO y comprueban el destino. Solicitan solo el permiso de Sheets. El token permanece en memoria y se descarta al recargar/desconectar; nunca leen ni reutilizan el almacenamiento de la app normal. Consulta UI.md para gestionar temas y grupos.

OAuth real fue validado el 15/11/2026 en Chrome desde http://localhost:3002, con lectura de la copia y un guardado reversible verificado en Sheets. Inicialmente Google rechazaba tanto 3002 como 3000 con origin_mismatch; se abrió el cliente de Cloud para que el usuario autorizase el origen. No se modificaron sus credenciales o configuración mediante automatización. La opción --port sigue disponible, pero no evita la necesidad de autorizar el origen exacto. Ver PILOT.md.

## Rutas

- GET /api/repertorio-test?api=environment: ID de desarrollo, capacidad de escritura, fase y módulos bloqueados.
- GET /api/repertorio-test?api=oauth: cliente existente, permiso de Sheets e identificador de sesión de desarrollo.
- POST /api/repertorio-test: operaciones JSON de repertorio. Requiere Authorization: Bearer con un token válido de Google. En el despliegue del archivo api/repertorio-test.js, la escritura está desactivada salvo REPERTOIRE_DEVELOPMENT_WRITES=enabled; sigue limitada a la copia.

No se admiten rangos, perfiles, sheetId, llamadas arbitrarias a Google o un spreadsheetId distinto. Un spreadsheetId igual al de la copia es opcional, por compatibilidad explícita; el servidor siempre utiliza su constante.

## Consulta y versiones

```json
{"action":"validate"}
```

Devuelve themes, assignments, groups, issues y version, además del destino y la indicación de que no se ha modificado Calendar ni datos heredados. Las filas de plantilla con FALSE no son registros. Las filas parciales, fórmulas en entradas, UUID duplicados y referencias no válidas se presentan como incidencias. Mientras existan incidencias se bloquean las escrituras para revisarlas.

```json
{"action":"catalog","includeArchived":false}
```

```json
{"action":"groupRepertoire","grupo":"Nombre del catálogo Coles","includeArchived":false}
```

La última consulta añade contadores por relación, sin duplicar temas por pertenecer a varios tipos. Realizado y Repasando pueden solaparse.

Cada escritura incluye expectedVersion con la version devuelta por la consulta anterior. La versión contempla los datos de entrada del catálogo, relaciones y nombres de Coles. Se relee inmediatamente antes de guardar y se vuelve a verificar el resultado.

## Escrituras

Guardar un tema completo; generar el UUID una sola vez y conservarlo en todos los reintentos:

```json
{
  "action":"saveTheme",
  "expectedVersion":"huella de la última lectura",
  "theme":{
    "id":"UUID en minúsculas",
    "nombre":"Nombre del tema",
    "numeroOrden":1,
    "temaGaleta":true,
    "temaSlap":false,
    "temaPropio":false,
    "activo":true,
    "notas":""
  }
}
```

Campos y acciones adicionales:

- assignThemes: grupo y assignments, lista de hasta 50 objetos {id, temaId}. Reasignar una relación archivada recupera su ID y seguimiento. Una relación nueva empieza con ambos estados a false. Un UUID ya usado por otra relación produce conflicto.
- updateProgress: vinculoId y changes, con uno o varios de realizado, repasando, fechaRealizado, ultimoRepaso, proximoObjetivo, motivoRepaso o notas. Cambia únicamente los campos enviados. Al marcar Realizado por primera vez propone la fecha de Madrid si no hay fecha; el usuario puede enviarla explícitamente, incluso vacía si es histórica desconocida.
- markForReview: ids de hasta 50 relaciones, más motivoRepaso y proximoObjetivo opcionales. Marca Repasando, conservando Realizado y Último repaso.
- recordRehearsal: ids y date opcional en formato YYYY-MM-DD. Cambia Último repaso; no modifica los dos estados. Sin date, usa la fecha actual de Madrid.
- archiveTheme: temaId y activo booleano. false archiva; true recupera y vuelve a comprobar tipos y orden.
- archiveAssignment: vinculoId y activo booleano. false archiva; true recupera conservando estados y notas.

Estas acciones también exigen expectedVersion. No existen borrados físicos ni operaciones sobre alumnos. La retirada de los registros DEMO de la prueba autenticada se hizo mediante una limpieza de conector acotada y con comprobación de sus IDs, no añadiendo un borrado genérico a la API.

## Datos nativos y fórmula

Los booleanos se escriben como boolValue; las fechas de realizado/repaso como seriales nativos, con formato dd/mm/yyyy. ActualizadoEn se guarda como texto ISO UTC técnico y no se usa como única versión ni como auditoría de ediciones directas.

NombreTema se genera al escribir cada relación con una fórmula de búsqueda por TemaID. Se validó la fórmula con separadores de es_ES y su valor calculado en el libro real de desarrollo. La respuesta del servicio resuelve el nombre desde el catálogo; no acepta un nombre duplicado como entrada del usuario.

Los textos, incluidos los que empiezan por =, se guardan con stringValue, sin ejecutarlos como fórmulas. Los nombres de Coles conservan sus espacios históricos para respetar su validación nativa; identidad y alias se resuelven mediante GroupIdentity.

## Conflictos y límites

- 400 INVALID_INPUT: campos o tipos incorrectos.
- 401 AUTH_REQUIRED: falta la sesión de Google.
- 403 FORBIDDEN_TARGET / FORBIDDEN_RANGE / FORBIDDEN_WRITE: destino u operación bloqueados.
- 403 READ_ONLY: servidor en consulta.
- 409 REVIEW_EXPIRED: datos modificados; recargar y revisar.
- 409 DATA_ISSUES / ORDER_CONFLICT / SCHEMA_MISMATCH: incidencia de integridad o esquema.
- 503 WRITE_UNCERTAIN: el envío o su verificación no pudo confirmarse. Consultar validate antes de reintentar con los mismos IDs y valores.

Las escrituras se serializan dentro del proceso y se comprueban por huella. Esto no proporciona una transacción distribuida frente a otros servidores o ediciones simultáneas de Sheets. No se promete esa garantía.

Se opera dentro de las filas existentes; no se añaden dimensiones ni se modifican cabeceras. El límite de seguridad de lectura es 10.000 filas por pestaña y cada lote tiene como máximo 50 relaciones. Si se agota la plantilla se devuelve CAPACITY y se debe ampliar únicamente la pestaña nueva antes de continuar.

## Validación realizada

- Pruebas de modelo, servicio, API y servidor local con Google simulado.
- Ciclo autenticado en la copia, mediado por el conector de Sheets: ejecutar el mismo handler y servicio, crear DEMO, asignar, marcar estados, registrar fecha, reintentar, archivar y recuperar; después retirar los registros temporales y releer.
- Esta prueba verifica las operaciones y el cálculo real de Sheets. No se presenta como una prueba de OAuth del navegador ni como un despliegue remoto.
- Evidencias en evidence/phase2-live.json y evidence/phase2.json.

## Interfaz integrada en producción (16/11/2026)

La sección productiva se monta en index.html y reutiliza la sesión principal existente, comprobando modo, libro, permiso de Sheets y caducidad. No crea otro cliente OAuth ni almacenamiento de token. Esto no modifica el contrato ni las barreras de la API: sigue limitada a Temas y GrupoTemas, sin acceso a Calendar. El acceso de desarrollo descrito arriba conserva su sesión separada. Ver INTEGRATION.md.
