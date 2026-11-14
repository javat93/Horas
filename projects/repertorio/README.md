# Proyecto: repertorio por grupo

Preparado el 14/11/2026. Trabajo por fases sobre una copia completa del libro en uso. La última fase migra solo el repertorio al original.

## Estado actual

- Fase 0 completada: libro original identificado en Drive, copia completa creada y verificada, rama de código independiente preparada.
- Fase 1 completada como plantilla: Temas y GrupoTemas creadas en la copia, con cabeceras, casillas nativas, filtros, fechas y validaciones básicas. No contiene temas o estados de aprendizaje inventados.
- Fases 2 a 5 pendientes: el módulo funcional y la conexión de la app a la copia todavía no están implementados. La fórmula NombreTema y las reglas cruzadas se implementarán con el módulo.
- No se ha desplegado, activado ni migrado repertorio en producción.

## Ubicaciones

- Copia de desarrollo: [abrir el libro](https://docs.google.com/spreadsheets/d/1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k/edit).
- Carpeta de Drive: ChatGPT.
- Trabajo de código: `C:\Users\Javat\Documents\GitHub\Horas-repertorio`.
- Rama: `feature/repertorio-grupos`.
- Base: `d601809c06d31df0d4352e12f612323c8691a2fd`.
- El repositorio principal conserva sus cambios locales previos. Este worktree parte del commit indicado; no incorpora automáticamente las modificaciones sin commit del repositorio principal.

## Alcance acordado

1. Detalle y Coles se conservan. El módulo solo consulta Coles para seleccionar grupos.
2. Sin alumnos, asistencias ni composición de clases.
3. Temas: nombre, número de orden y booleanos independientes TemaGaleta, TemaSlap y TemaPropio.
4. El mismo orden puede repetirse entre tipos distintos. Si un tema tiene varios tipos, su número se aplica a todos ellos.
5. GrupoTemas: una fila por grupo + tema. Realizado y Repasando son independientes y pueden estar marcados a la vez.
6. Ninguna operación del módulo modifica Calendar ni los datos de las sesiones.

## Documentos de trabajo

- [Fases y criterios de cierre](PHASES.md).
- [Procedimiento de migración final](MIGRATION.md).
- [Configuración e inventario del proyecto](project.json).
- [Esquema de las dos pestañas](schema.json).
- [Evidencia de la preparación](evidence/preparation.json).
- [Peticiones ya ejecutadas al preparar la copia](bootstrap-copy.requests.json): registro de auditoría, no volver a ejecutar.
- [Diseño funcional y técnico completo](DESIGN.md).

## Siguiente trabajo: fase 2

Implementar primero el modelo y un servicio que solo opere sobre el ID de desarrollo fijado en project.json. Crear un acceso de pruebas específico de repertorio; no sustituir los IDs de producción o de los entornos anteriores.

La copia conserva los vínculos de Calendar del libro original. No se debe arrancar la app normal contra ella con altas, bajas, sincronización o realizado automático habilitados. El nuevo acceso de desarrollo debe limitarse a repertorio, sin exponer operaciones de sesiones o Calendar.

Las validaciones de casillas han materializado valores FALSE en las filas de plantilla. Una fila con solo esos valores y sin identificadores no es un tema ni una asignación. El modelo debe distinguirla de una fila introducida parcialmente por el usuario.

El cambio final a producción se prepara y ensaya en las fases anteriores. No se copia el libro entero de desarrollo sobre el original, porque durante el proyecto pueden seguir cambiando las sesiones reales.
