# Fase 4: piloto y ensayo de migración

Preparado y probado técnicamente el 15/11/2026. La aceptación del repertorio y sus estados corresponde al usuario. La fase 5 no se ha ejecutado.

## Acceso

Arrancar `node sandbox/repertoire-server.cjs --write` y abrir http://localhost:3002 en Chrome. El servidor solo escucha en 127.0.0.1. El inicio de sesión mantiene el token en memoria, usa únicamente el permiso de Sheets y accede al ID de desarrollo fijado en servidor. Recargar la página exige reconectar; no se guarda una credencial permanente.

El inicio de sesión real funcionó desde localhost:3002. Antes devolvía `origin_mismatch`; se abrió el cliente OAuth Gemini del proyecto Batucada para que el usuario pudiera autorizar ese origen. No se modificaron credenciales ni permisos de Google Cloud mediante automatización. El SDK se prepara antes del clic para abrir la ventana de Google dentro del gesto del usuario, y la conexión permanece bloqueada mientras espera su respuesta.

## Datos del piloto

Catálogo real de 21 versiones con UUID persistentes: 13 pertenecen a Galeta, 10 a Slap y 5 a Propios. Siete versiones comparten Galeta y Slap y cuentan una sola vez. Las versiones propias se conservan separadas. Los nombres proceden del mensaje del usuario; se distinguen variantes con paréntesis.

El número de orden inicial sigue las listas aportadas. Es un único número por tema compartido: Merengue y PimPamPum de Maracuyá ocupan 11 y 12; Latin, Sambaduro y Markatu continúan en 13, 14 y 15 en ambos tipos. Se admiten números iguales para tipos que no se solapan. El usuario puede ajustar este orden desde Catálogo.

Slap Lunes tiene 10 asignaciones: Batucada, Sambareggae (Slap), Conga, Tarantela, Bahiao (Maracuyá), Merengue (Maracuyá), PimPamPum (Maracuyá), Latin (Maracuyá), Sambaduro (Maracuyá) y Markatu (Maracuyá).

La Maquinista tiene 5 asignaciones: Tarantela (propio), Conga (propio), Samba (propio), Sambareggae (Slap) y Batucada compartida Galeta/Slap.

El usuario confirmó la pertenencia de los temas, pero no indicó cuáles están realizados o repasando. Las 15 relaciones mantienen ambas casillas desmarcadas, fechas vacías y una nota que explica que falta confirmar el estado. «Pendiente» en la interfaz es el estado inicial técnico; no es una valoración de lo que sabe el grupo.

La carga inicial escribió exclusivamente Temas!A2:H22 y GrupoTemas!A2:M16 en desarrollo. NombreTema se calcula por TemaID con una fórmula local. No se dedujo ningún estado de Detalle ni se guardaron alumnos.

## Verificación real completada

- OAuth de navegador en Chrome: Google conectado; lectura mediante la API local real.
- Slap Lunes muestra 10 temas y La Maquinista muestra 5, con sus variantes y órdenes.
- Nota temporal de Slap Lunes/Batucada guardada desde la app y confirmada por una lectura independiente de Sheets. Realizado, Repasando y fechas permanecieron intactos.
- Edición directa externa de esa nota en la hoja mientras la app conservaba un borrador: el guardado rechazó la versión antigua y mantuvo el formulario. Actualizar permitió revisar y guardar el borrador.
- Nota original restaurada desde la interfaz y comprobada en Sheets; no quedan notas temporales. ActualizadoEn refleja la prueba real.
- Catálogo de desarrollo y GrupoTemas del ensayo revisados visualmente en Google Sheets, con casillas y nombres calculados.
- 241 pruebas automáticas aprobadas, incluidas 9 nuevas del migrador. Las pruebas con estados y fechas no vacíos usan datos simulados; no se inventaron estados en el piloto real.

Las comprobaciones de archivo/recuperación, reintentos, estados independientes y fechas también cuentan con la evidencia de las fases 2 y 3. Esta fase añade la conexión real por navegador, la persistencia de notas y el conflicto con una edición de Sheets.

## Ensayo ejecutado

Destino: [copia nativa de ensayo](https://docs.google.com/spreadsheets/d/1MTNHpssZNYicFxc_vtlV16Insdk5m4NSd7_DRHhjUXI/edit). Se creó a partir de desarrollo antes de cargar el catálogo; no es una copia actualizada de las sesiones de producción. Para esta fase se usan solo sus dos pestañas nuevas y los nombres de grupos de Coles. La copia reciente del original y su respaldo se harán en la fase 5.

El migrador `sandbox/repertoire-migration.cjs` arranca en dry-run. Solo admite los IDs de desarrollo y ensayo fijados en código y manifiesto; únicamente escribe las dos pestañas nuevas del ensayo. No crea, borra o renombra hojas ni permite cambiar el destino al original. Preparar producción requerirá una adaptación explícita y revisión en la fase 5.

El ensayo autenticado usó el mismo migrador mediante el conector de Sheets, sin extraer tokens del navegador:

1. Dry-run: 21 temas y 15 relaciones válidas; 36 inserciones, sin datos DEMO ni conflictos.
2. Aplicación: 36 filas; comparación de todos los campos por ID y de las fórmulas NombreTema calculadas.
3. Repetición del plan: 0 filas y ningún duplicado.
4. Reversión: recuperación verificada de valores, formatos numéricos y validaciones anteriores de las filas afectadas.
5. Segunda aplicación: 36 filas verificadas, 0 inserciones pendientes y origen sin cambios durante el ensayo. El destino queda poblado para revisión.

Una primera ejecución se detuvo por diferencia de huella antes de escribir. Se generó un nuevo dry-run y el ciclo completo terminó correctamente; la protección no se deshabilitó. El plan y los recibos están en evidence/phase4-migration-plan.json y el registro de llamadas en evidence/phase4-migration.json.

El ensayo se hizo antes de la prueba reversible de notas del navegador. El contenido funcional volvió al original, pero ActualizadoEn de una relación cambió. Por ello las huellas guardadas describen aquella instantánea y deben regenerarse antes de otra aplicación; no se deben reutilizar como un plan vigente de producción. El migrador rechaza sobrescribir un mismo ID con contenido distinto y rechaza revertir sobre cambios posteriores.

Las escrituras del ensayo fueron tres lotes de 36 actualizaciones de fila, todos en Temas y GrupoTemas del destino. No hubo escrituras en desarrollo desde el migrador, en el original, en Detalle, en Coles ni llamadas a Calendar.

## Revisión pendiente del usuario

1. Abrir Por grupo y comprobar que las versiones asignadas a ambos grupos son las correctas.
2. Marcar Realizado y Repasando según la situación real; ambas pueden estar activas. Si entra gente nueva, activar Repasando conserva Realizado. Registrar repaso se usa solo para anotar que el repaso ocurrió.
3. Revisar nombres y orden del catálogo, en particular la variante Samba de La Maquinista, interpretada como propia.
4. Aceptar el piloto cuando esos datos reflejen el uso real. Después se podrá preparar y autorizar la migración final conforme a MIGRATION.md.

No hay una activación automática en producción al aceptar o editar el piloto.
