# Migración final de repertorio

Estado: procedimiento preparado, migrador por implementar y ensayar en la fase 4. No se ha ejecutado sobre producción.

## Origen y destino

- Origen de repertorio validado: copia de desarrollo 1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k.
- Destino final: libro original configurado en producción, 1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60. Reconfirmarlo al ejecutar, no dar por vigente esta identificación indefinidamente.
- Único contenido migrable: Temas y GrupoTemas, con sus IDs, estados, fechas, notas y estructura nativa.
- No migrar Detalle, Coles, resúmenes, papelera, operaciones pendientes de Calendar ni metadatos heredados de otros módulos.

## Antes del paso final

1. Fases 2 a 4 terminadas con evidencia. Todo dato de prueba identificado y excluido o eliminado del conjunto migrable.
2. Congelar las ediciones de repertorio en la copia para fijar una versión; no hace falta detener el uso ordinario de las sesiones reales.
3. Releer metadatos y esquema de los dos libros. Verificar que origen y destino son distintos, sus identidades coinciden con el plan y se mantiene es_ES/Europe/Madrid.
4. Crear un respaldo nativo reciente del destino y verificar su URL e ID. Registrar fecha, versión del código y huellas del repertorio que se va a migrar.
5. Validar GrupoTemas contra Coles del original actual, usando alias conocidos y resolución inequívoca. Los grupos desaparecidos o renombrados necesitan una correspondencia explícita; no se crean grupos automáticamente.
6. Consultar si el destino ya contiene Temas o GrupoTemas. Si no existen, planificar su creación. Si existen, detenerse ante esquema desconocido o datos ajenos; ante una migración anterior reconocida, conciliar por UUID, sin duplicar ni sobrescribir cambios posteriores.

## Plan dry-run

El informe debe incluir origen y destino; pestañas, rangos y columnas; filas válidas a crear/actualizar; IDs archivados; fórmulas; validaciones; huellas antes/después esperadas; referencias resueltas; datos DEMO excluidos e incidencias.

Los booleanos FALSE de las filas vacías de plantilla no cuentan como registros. Una fila parcial no se descarta como si estuviera vacía: se informa y se resuelve antes de continuar.

No aplicar si hay órdenes activos incompatibles, duplicados de grupo + TemaID, UUID repetidos, referencias huérfanas, un destino cambiado o datos que no correspondan con el plan.

El migrador debe arrancar en modo dry-run. La función de aplicación solo admite planes de la fase final verificados; no es una opción disponible desde la interfaz habitual.

## Aplicación

1. Releer los rangos afectados y comprobar las mismas huellas del dry-run. Si han cambiado, regenerar el plan.
2. Crear o completar únicamente las dos pestañas de repertorio. Resolver los sheetId del destino; nunca reutilizar ciegamente los de desarrollo.
3. Conservar TemaID y VinculoID. Escribir booleanos nativos, fechas y texto literal con los formatos probados. Reconstruir NombreTema con referencias al catálogo local del destino, sin vínculos al libro de pruebas.
4. Si se requieren varios lotes, registrar cuáles están verificados para poder reanudar. Los reintentos se concilian por UUID y contenido esperado, no por anexar otra vez todas las filas.
5. Volver a leer y comparar por ID todos los registros migrados: nombres, órdenes, tipos, Realizado, Repasando, fechas, notas y archivo. Comparar fórmulas y validaciones por separado de los valores visibles.
6. Verificar que todas las peticiones de escritura se limitaron a los sheetId permitidos y que se conservan las pestañas anteriores. Si hubo uso simultáneo de sesiones reales, sus cambios legítimos no se confunden con daños de la migración.

## Activación

Publicar el módulo con la capacidad desactivada por defecto. Tras verificar los datos, habilitar lectura y comprobar el recorrido; después habilitar escritura de repertorio. Las banderas y permisos de sesiones y Calendar se mantienen como estaban.

Realizar un cambio pequeño y reversible en una nota de repertorio, releer para verificar y revertirlo. Comprobar que las demás columnas y pestañas permanecen ajenas a esa operación.

## Recuperación

- Si fallan los datos antes de activar, mantener deshabilitado el módulo y conservar las sesiones ordinarias operativas.
- Con migración parcial, reconciliar los lotes por UUID y su informe antes de reanudar; no repetir la carga a ciegas.
- Si es necesario retroceder, restaurar solo los rangos/pestañas de repertorio afectados desde la copia de seguridad y conservar la evidencia de la migración fallida.
- No restaurar todo el libro ni eliminar pestañas a ciegas: podrían perderse sesiones, pagos o cambios reales posteriores al respaldo.
- Si el usuario ya ha introducido cambios nuevos de repertorio en producción, preservar y conciliar esos cambios antes de restaurar datos antiguos.

## Cierre

Registrar fecha de finalización, versión desplegada, respaldo, informe de conteos y huellas, pruebas realizadas e incidencias. Actualizar project.json solo tras comprobar la migración y activación.

A partir del cierre, el libro original es el maestro del repertorio. La copia de desarrollo se conserva identificada como archivo; no se sincronizan dos maestros.
