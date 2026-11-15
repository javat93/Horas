# Proyecto: repertorio por grupo

Preparado el 14/11/2026. Trabajo por fases sobre una copia completa del libro en uso. La última fase migra solo el repertorio al original.

## Estado actual

- Fase 0 completada: libro original identificado en Drive, copia completa creada y verificada, rama de código independiente preparada.
- Fase 1 completada como plantilla: Temas y GrupoTemas creadas en la copia, con cabeceras, casillas nativas, filtros, fechas y validaciones básicas. No contiene temas o estados de aprendizaje inventados.
- Fase 2 completada el 15/11/2026: modelo, API y acceso técnico local limitados a la copia, con fórmula NombreTema y reglas de integridad implementadas. Prueba autenticada mediada por el conector de Sheets completada y datos DEMO retirados.
- Fase 3 implementada el 15/11/2026: catálogo, repertorio por grupo y lista de grupos, con pruebas funcionales de escritorio y móvil en un entorno simulado separado. La interfaz usa la API fijada a la copia de desarrollo.
- Fases 4 y 5 pendientes: piloto con repertorio real y migración. El módulo no está integrado en la app productiva.
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
- [API, arranque local y límites de validación](API.md).
- [Evidencia de la fase 2](evidence/phase2.json).
- [Prueba autenticada sobre la copia](evidence/phase2-live.json).
- [Uso de la interfaz de desarrollo](UI.md).
- [Evidencia de la fase 3](evidence/phase3.json).

## Siguiente trabajo: fase 4

Validar el inicio de sesión de Google y el recorrido real con un grupo piloto en la copia, cargar su repertorio y ensayar la migración. La interfaz está disponible con `node sandbox/repertoire-server.cjs --write` en http://localhost:3002; el acceso técnico por JSON se conserva en /tecnico. No sustituir los IDs de producción o de los entornos anteriores. El inicio de sesión OAuth del navegador no se ha probado ni se ha modificado Google Cloud; la prueba autenticada de Sheets de la fase 2 se realizó mediante el conector.

La copia conserva los vínculos de Calendar del libro original. No se debe arrancar la app normal contra ella con altas, bajas, sincronización o realizado automático habilitados. El nuevo acceso de desarrollo debe limitarse a repertorio, sin exponer operaciones de sesiones o Calendar.

Las validaciones de casillas han materializado valores FALSE en las filas de plantilla. Una fila con solo esos valores y sin identificadores no es un tema ni una asignación. El modelo debe distinguirla de una fila introducida parcialmente por el usuario.

El cambio final a producción se prepara y ensaya en las fases anteriores. No se copia el libro entero de desarrollo sobre el original, porque durante el proyecto pueden seguir cambiando las sesiones reales.
