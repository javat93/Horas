# Fases del proyecto

Fecha de preparación: 14/11/2026. La numeración es una secuencia de entregas; no representa fechas estimadas. Cada fase cierra con evidencia verificable antes de depender de ella.

## Fase 0 — Preparación y copia aislada · COMPLETADA

Entregado:

- Identificación en vivo del libro que usa la configuración actual de producción.
- Copia nativa de todo el libro, con un ID nuevo y título de desarrollo.
- Conservación de las seis pestañas anteriores, incluida Papelera Horas.
- Rama feature/repertorio-grupos y worktree independiente desde d601809.
- Manifiesto con IDs de origen y desarrollo, esquema y restricciones.

Verificación realizada: IDs distintos, metadatos de pestañas conservados y fecha de modificación del original sin cambios entre las lecturas anterior y posterior. No es una comparación exhaustiva de todas las celdas del libro.

## Fase 1 — Plantilla de repertorio · COMPLETADA COMO ESTRUCTURA

Entregado en la copia:

- Temas!A1:H1001: ocho cabeceras, booleanos nativos, validación positiva del número, filtro y cabecera congelada.
- GrupoTemas!A1:M1001: trece cabeceras, casillas Realizado/Repasando/Activo, grupos desde Coles y formatos de fecha.
- IDs ocultos y rangos con avisos de protección. Los avisos no constituyen una restricción de permisos.
- Notas en cabeceras para explicar el número por tipo y la coexistencia Realizado + Repasando.

No se ha introducido catálogo, realizado asignaciones ni calculado estados a partir de Detalle. El modelo de relaciones, la fórmula NombreTema, la validación del número entero y la comprobación de órdenes por tipo corresponden a la fase 2. Se revisaron visualmente Temas y las dos zonas horizontales de GrupoTemas en Google Sheets al 100%, comprobando cabeceras, casillas y presentación.

## Fase 2 — Modelo y servicio aislado · COMPLETADA EL 15/11/2026

Objetivo: poder leer y guardar repertorio en la copia con reglas fiables, antes de conectarlo a la interfaz.

Tareas:

- Implementar repertoire-model.js: validación estricta de campos, tipos, UUID, fechas y números enteros positivos.
- Validar órdenes repetidos por intersección de tipos activos, admitiendo Galeta 1 + Slap 1 + Propio 1.
- Reutilizar GroupIdentity para normalizar grupos y alias; detectar referencias ambiguas y grupos que ya no existen.
- Ignorar filas de plantilla con solo FALSE. Presentar filas parciales sin ID como incidencias de importación.
- Implementar repertoire-service.cjs y un endpoint de desarrollo específico, fijado en servidor al ID de la copia.
- Restringir las escrituras a Temas y GrupoTemas y las lecturas adicionales a Coles. No aceptar un spreadsheetId alternativo como destino.
- Añadir la búsqueda NombreTema por TemaID y comprobar su sintaxis/formato en es_ES.
- Crear y archivar temas; asignar varios temas, recuperar relaciones archivadas y actualizar seguimiento sin duplicar.
- Releer antes de guardar, comprobar versiones, aplicar solo campos permitidos y verificar el resultado. Resolver reintentos mediante IDs persistentes.
- Configuración local diferenciada: identificación visible de DESARROLLO y sesión de acceso independiente. Mantener bloqueadas las operaciones heredadas de sesiones y Calendar.

Cierre:

- Pruebas de modelo y de servicio con Google simulado, incluidos rechazos antes de llamar a Google para un destino o pestaña no permitidos.
- Prueba autenticada acotada en las pestañas nuevas de la copia, con datos DEMO identificados y retirada posterior.
- Guardar evidencia de la prueba y confirmar que no se escribe en Detalle, Coles ni Calendar.

Evidencia de cierre: modelo y API implementados; pruebas automáticas del módulo y regresión completa aprobadas; ciclo autenticado del handler/servicio a través del conector de Sheets, con ocho lotes de escritura limitados a las dos pestañas nuevas, fórmula calculada y fechas nativas verificadas. Datos temporales retirados tras comprobar sus IDs. Acceso técnico local revisado en navegador. No se ha desplegado el endpoint ni validado un nuevo inicio de sesión OAuth desde el navegador; el alcance de esa comprobación queda explícito en API.md y en las evidencias.

## Fase 3 — Interfaz funcional · IMPLEMENTADA EL 15/11/2026

Objetivo: gestionar el repertorio desde la app de desarrollo con una interfaz cómoda en móvil y escritorio.

Tareas:

- Nueva sección Repertorio: Catálogo y Por grupo; acceso directo desde la lista de grupos.
- Alta y edición de temas, selección independiente de tipos y edición del número.
- Selector de grupo, asignación múltiple y filtro por tipo, realizado, pendiente y repasando.
- Realizado y Repasando independientes. Activar Repasando conserva Realizado.
- Separar «Marcar para repasar» de «Registrar repaso»: solo la segunda acción cambia Último repaso.
- Notas, motivo, próximo objetivo, archivo recuperable y acciones por lotes.
- Contadores por TemaID, sin duplicar los temas que tienen varios tipos.
- Mostrar errores, cambios sin guardar, conflictos y guardados pendientes de comprobar. Deshabilitar el control mientras se guarda.

Cierre:

- Recorrido visual y funcional en móvil y escritorio dentro del entorno de desarrollo.
- Dos grupos con un mismo tema y estados diferentes.
- Flujo Realizado → Realizado + Repasando → Realizado, sin pérdida de estado.
- El nuevo módulo funciona sin ejecutar sincronizaciones ni acciones de sesiones.

Evidencia de implementación: recorridos funcionales en navegador sobre un servidor de simulación sin Google, usando el mismo handler, servicio y modelo que desarrollo. Comprobados el alta con varios tipos, conflicto de orden, asignación múltiple, independencia entre dos grupos, estados, fechas, archivo/recuperación, acciones por lotes, filtros y notas. Un conflicto conserva el formulario y una respuesta perdida permite verificar y reintentar sin duplicar. Vista de escritorio y móvil 390 × 844 revisadas, sin desbordamiento horizontal. Interfaz de desarrollo real y sus capacidades comprobadas sin iniciar una nueva sesión de Google. El piloto autenticado por navegador se valida en la fase 4; no se presenta la simulación como una escritura real en Sheets. Ver UI.md y evidence/phase3.json.

## Fase 4 — Piloto, aceptación y ensayo de migración · PENDIENTE

Objetivo: validar el funcionamiento con repertorio real y ensayar el paso final antes de tocar producción.

Tareas:

- Cargar el catálogo real y elegir un grupo piloto. El usuario aporta o marca lo que sabe cada grupo; no se inventan datos.
- Comprobar tipos, orden, estados, notas y fechas contra el uso cotidiano.
- Resolver importaciones parciales, grupos ambiguos, duplicados y referencias huérfanas.
- Probar edición directa de notas/casillas desde Sheets y conflicto con una app que mantenga datos antiguos.
- Verificar archivo/restauración de relaciones, reintentos y el comportamiento al cambiar nombre u orden de un tema.
- Ejecutar pruebas de regresión pertinentes de la app actual. No modificar sus reglas económicas ni de Calendar.
- Implementar el migrador con modo dry-run por defecto y lista cerrada de las dos pestañas nuevas.
- Ensayar la migración sobre un segundo clon reciente del original: aplicar una vez, verificar, repetir sin duplicaciones y ensayar desactivación/recuperación.
- Separar y retirar datos DEMO del conjunto que va a migrarse.

Cierre:

- Informe de aceptación y evidencia del ensayo, con conteos por IDs y comparación de booleanos, fechas, referencias y notas.
- Plan exacto de migración generado: origen, destino, rango por pestaña, huellas y conflictos resueltos.
- Ninguna incidencia abierta que afecte a datos, aislamiento o el flujo principal.

## Fase 5 — Migración y activación en el original · ÚLTIMA FASE, PENDIENTE

Objetivo: incorporar el repertorio validado al libro original sin sustituir sus pestañas existentes.

Orden obligatorio:

1. Cerrar la validación funcional y congelar temporalmente las ediciones del repertorio en la copia.
2. Leer el original actual, crear una copia de seguridad reciente y verificarla.
3. Revalidar los grupos contra Coles del original y comprobar que no hay colisiones con pestañas existentes.
4. Revisar y aplicar el plan ya ensayado, limitado a Temas y GrupoTemas.
5. Verificar el contenido migrado y la conservación de las pestañas anteriores.
6. Activar la sección del módulo en producción primero en consulta y después en escritura; no cambiar la configuración de sesiones o Calendar.
7. Probar un cambio de repertorio reversible y verificar su persistencia.
8. Cerrar el informe de migración. El original pasa a ser el único maestro del repertorio y la copia queda como archivo de validación.

Si falla la verificación, se detiene la activación y se aplica el procedimiento de recuperación de MIGRATION.md. No se restaura todo el libro sobre sesiones reales que hayan seguido cambiando.

## Ampliaciones fuera de estas fases

Matriz comparativa de temas × grupos e historial de todos los repasos. No se necesita ninguna de ellas para cerrar esta primera versión.
