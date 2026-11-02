# Activación del modo protegido

Estado configurado el02/11/2026: hoja real migrada y verificada; interfaz de producción con revisiones protegidas. Se comprobó primero la lectura autenticada antes de habilitar escrituras. La migración se ejecutó aparte; desplegar código no vuelve a aplicar lotes.
Actualización de migración del 02/11/2026: los 17 lotes se aplicaron a la hoja real y la verificación nativa coincide exactamente con el ensayo (1534 fechas, 1292 fórmulas, 51015,16 €, 239 referencias protegidas). El usuario autorizó específicamente las 28 celdas de enlaces/horarios tras la revisión automática. `activation.json` registra la activación gradual; las tres variables equivalentes de entorno prevalecen sobre ese archivo y permiten retirar escrituras con un valor vacío. No contiene secretos. La configuración del frontend se cambia en una etapa posterior a comprobar el backend en solo lectura.

## Perfiles

- `test`: copia actual; `/api/test`. Sigue bloqueando el ID real y el de ensayo.
- `rehearsal`: clon del ensayo 29/10; acceso separado `/api/rehearsal`, inicialmente solo lectura. Realizado automático pausado en servidor e interfaz durante el ensayo.
- `production`: hoja real; `/api/production`, cerrado por defecto.

Los IDs se fijan en código y nunca se aceptan desde parámetros de perfil enviados por el navegador. AsyncLocalStorage aísla el destino durante cada petición. Los servicios comparten las mismas revisiones, lectura nativa, papelera y protección de operaciones inciertas. Una barrera adicional comprueba cada URL remota y mantiene Calendar en GET.

## Orden de activación

1. Conservar `config.production.js` actual hasta completar el ensayo/migración acordados. `config.production.candidate.js` y `config.rehearsal.candidate.js` son candidatos, no se cargan automáticamente.
2. Abrir `index.html?ensayo=protegido`, que carga únicamente el candidato rehearsal. `/api/rehearsal` fija el clon en servidor y arranca con writeEnabled=false. Tras comprobar lectura autenticada, se habilita de forma explícita writeEnabled en ese endpoint para el ensayo recuperable. Nunca se cambia el destino habitual ni se habilita /api/production. Puede retirarse de nuevo la escritura al cerrar el ensayo. No se permiten IDs o perfiles arbitrarios por query.
3. Revalidar y aplicar la migración de datos únicamente cuando el usuario solicite la ejecución. Crear respaldo reciente, aplicar los lotes ya ensayados y verificar datos/resúmenes. Este repositorio no contiene datos privados ni esos lotes.
4. Para la hoja real, establecer `HORAS_PROTECTED_PROFILE=production` y, solo después de verificar la migración, `HORAS_MIGRATION_VERIFIED=migracion-20261102`. Mantener `HORAS_PROTECTED_WRITES` sin activar inicialmente. Este marcador es una confirmación operativa, no una consulta automática de hashes a Google.
5. Comprobar `/api/production?api=environment`: modo production, ID real, protectedMode=true, writeEnabled=false, Calendar solo lectura, appWrites=false. El navegador comprueba modo, ID, fase y capacidades y bloquea destinos cruzados.
6. Sustituir `config.production.js` por el contenido del candidato production y renovar su versión de caché en index.html. El candidato tiene `TEST_MODE=false` y `PROTECTED_MODE=true`: las protecciones NO dependen de mostrar la cabecera de pruebas. No reutiliza el token almacenado de pruebas; hay una sesión separada para cada perfil.
7. Después de verificar lectura, establecer `HORAS_PROTECTED_WRITES=enabled`, recargar y confirmar que frontend y backend coinciden. Probar una operación recuperable expresamente acordada, sin modificar Calendar.

La interfaz productiva no muestra cabeceras, comentarios ni herramientas de pruebas. «Papelera» está en la cabecera normal y «Sincronizar» abre un selector de mes antes de revisar cambios. Los revisores y la validación del destino siguen funcionando internamente; los mensajes operativos y errores se muestran cuando corresponde. Las herramientas de auditoría y la revisión explícita de permisos quedan fuera de la vista de producción. La prueba temporal del valor42 no se habilita en producción ni en ensayo; tampoco la prueba temporal numérica/gráfico.

La app habitual utiliza el perfil real. `?pruebas=copia` conserva la copia anterior y `?ensayo=protegido` abre el clon del ensayo, que quedó en solo lectura tras completar alta, pago/reversión, archivo/restauración y comprobación del histórico. Realizado automático permanece pausado en ese clon. Google Cloud y la verificación de marca no forman parte de esta activación.

## Volver a solo lectura

Quitar `HORAS_PROTECTED_WRITES` impide escrituras en el backend protegido, incluso desde pestañas antiguas de ese perfil. Recargar refleja el estado en la interfaz. Si se vuelve al entorno de pruebas, restaurar el config anterior; su endpoint `/api/test` permanece aislado y no depende de la selección de producción. Los proxies antiguos `/api/sheets` y `/api/calendar` ahora delegan solo lecturas a la política exacta de pruebas y rechazan escrituras genéricas; no pueden saltarse la puerta de activación de producción. La configuración protegida nunca los utiliza.

## Verificación

`node --test sandbox/*.test.cjs` cubre los perfiles con Google simulado, incluyendo destinos cruzados, concurrencia, fechas e importes nativos, excepciones de precio/barrio/dirección, pago, papelera/restauración, Calendar de solo lectura y la interfaz con TEST_MODE=false.

`node sandbox/preview-production.cjs` ofrece una vista local en http://localhost:3011, sin conexión a Google, con escrituras desactivadas. Sirve el HTML y panel reales, configuración production y un backend simulado. No acredita por sí solo un ensayo autenticado contra Google.
