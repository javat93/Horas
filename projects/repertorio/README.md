# Proyecto: repertorio por grupo

Preparado el 14/11/2026. Trabajo por fases sobre una copia completa del libro en uso. La última fase migra solo el repertorio al original.

## Estado actual

- Fase 0 completada: libro original identificado en Drive, copia completa creada y verificada, rama de código independiente preparada.
- Fase 1 completada como plantilla: Temas y GrupoTemas creadas en la copia, con cabeceras, casillas nativas, filtros, fechas y validaciones básicas. No contiene temas o estados de aprendizaje inventados.
- Fase 2 completada el 15/11/2026: modelo, API y acceso técnico local limitados a la copia, con fórmula NombreTema y reglas de integridad implementadas. Prueba autenticada mediada por el conector de Sheets completada y datos DEMO retirados.
- Fase 3 implementada el 15/11/2026: catálogo, repertorio por grupo y lista de grupos, con pruebas funcionales de escritorio y móvil en un entorno simulado separado. La interfaz usa la API fijada a la copia de desarrollo.
- Fase 4 cerrada para migración por la petición expresa del usuario del 15/11/2026. Conserva los estados iniciales sin afirmar que los temas estén aprendidos.
- Fase 5 completada el 15/11/2026: respaldo reciente verificado, 21 temas y 15 relaciones migrados al original, acceso publicado primero en consulta y después en escritura y prueba reversible de nota verificada.
- Fase 6 completada el 16/11/2026: adaptación visual prioritaria para móvil, navegación inferior, estados táctiles y formularios inferiores; sin cambios de datos. Ver [PHASE6.md](PHASE6.md).
- El original es el único maestro del repertorio. Desarrollo se conserva como archivo de validación, con el servidor local en consulta y sin sincronización de vuelta.

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
- [Piloto real y resultado del ensayo](PILOT.md).
- [Evidencia de la fase 4](evidence/phase4.json).
- [Registro de la migración de ensayo](evidence/phase4-migration.json).
- [Plan y recibos de la instantánea ensayada](evidence/phase4-migration-plan.json).
- [Cierre y recuperación de la migración final](PHASE5.md).
- [Evidencia de cierre de la fase 5](evidence/phase5.json).

## Uso actual

Abrir [Repertorio en la aplicación](https://javat93.github.io/Horas/repertorio.html), también accesible desde la navegación de Horas. Conectar Google y elegir el grupo. Las casillas Realizado/Repasando se ajustan según la situación real; esta migración no las inventó. Repertorio está integrado en la navegación principal y reutiliza su conexión de Google, sin solicitar otros permisos. El backend sigue limitado a las pestañas del repertorio y no opera sobre Calendar. Ver [INTEGRATION.md](INTEGRATION.md). No editar desarrollo como segundo maestro. El servidor de archivo arranca con `node sandbox/repertoire-server.cjs`, sin --write, en http://localhost:3002. PHASE5.md contiene el respaldo, los recibos y el alcance exacto de las comprobaciones.

La copia conserva los vínculos de Calendar del libro original. No se debe arrancar la app normal contra ella con altas, bajas, sincronización o realizado automático habilitados. El nuevo acceso de desarrollo debe limitarse a repertorio, sin exponer operaciones de sesiones o Calendar.

Las validaciones de casillas han materializado valores FALSE en las filas de plantilla. Una fila con solo esos valores y sin identificadores no es un tema ni una asignación. El modelo debe distinguirla de una fila introducida parcialmente por el usuario.

El cambio final a producción se prepara y ensaya en las fases anteriores. No se copia el libro entero de desarrollo sobre el original, porque durante el proyecto pueden seguir cambiando las sesiones reales.
