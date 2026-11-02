# Activación del modo protegido

Estado preparado, sin activar: la app publicada sigue usando la copia. La migración de datos es una operación aparte y no se ejecuta con este código.

## Perfiles

- `test`: copia actual; `/api/test`. Sigue bloqueando el ID real y el de ensayo.
- `rehearsal`: clon del ensayo 29/10; `/api/production` únicamente cuando el servidor selecciona este perfil.
- `production`: hoja real; `/api/production`, cerrado por defecto.

Los IDs se fijan en código y nunca se aceptan desde parámetros de perfil enviados por el navegador. AsyncLocalStorage aísla el destino durante cada petición. Los servicios comparten las mismas revisiones, lectura nativa, papelera y protección de operaciones inciertas. Una barrera adicional comprueba cada URL remota y mantiene Calendar en GET.

## Orden de activación

1. Conservar `config.production.js` actual hasta completar el ensayo/migración acordados. `config.production.candidate.js` y `config.rehearsal.candidate.js` son candidatos, no se cargan automáticamente.
2. Para el ensayo, establecer en el backend `HORAS_PROTECTED_PROFILE=rehearsal`. La ausencia de `HORAS_PROTECTED_WRITES` deja el clon en solo lectura. Tras comprobar lectura, `HORAS_PROTECTED_WRITES=enabled` permite las operaciones protegidas. Usar el candidato rehearsal en una versión de ensayo, sin sustituir la app habitual hasta revisar resultados.
3. Revalidar y aplicar la migración de datos únicamente cuando el usuario solicite la ejecución. Crear respaldo reciente, aplicar los lotes ya ensayados y verificar datos/resúmenes. Este repositorio no contiene datos privados ni esos lotes.
4. Para la hoja real, establecer `HORAS_PROTECTED_PROFILE=production` y, solo después de verificar la migración, `HORAS_MIGRATION_VERIFIED=migracion-20261102`. Mantener `HORAS_PROTECTED_WRITES` sin activar inicialmente. Este marcador es una confirmación operativa, no una consulta automática de hashes a Google.
5. Comprobar `/api/production?api=environment`: modo production, ID real, protectedMode=true, writeEnabled=false, Calendar solo lectura, appWrites=false. El navegador comprueba modo, ID, fase y capacidades y bloquea destinos cruzados.
6. Sustituir `config.production.js` por el contenido del candidato production y renovar su versión de caché en index.html. El candidato tiene `TEST_MODE=false` y `PROTECTED_MODE=true`: las protecciones NO dependen de mostrar la cabecera de pruebas. No reutiliza el token almacenado de pruebas; hay una sesión separada para cada perfil.
7. Después de verificar lectura, establecer `HORAS_PROTECTED_WRITES=enabled`, recargar y confirmar que frontend y backend coinciden. Probar una operación recuperable expresamente acordada, sin modificar Calendar.

La interfaz normal muestra «Horas · Gestión protegida», sincronización y papelera. Los controles históricos de auditoría quedan en Herramientas de revisión, plegadas. La prueba temporal del valor 42 no se habilita en producción ni en ensayo; tampoco la prueba temporal numérica/gráfico.

## Volver a solo lectura

Quitar `HORAS_PROTECTED_WRITES` impide escrituras en el backend protegido, incluso desde pestañas antiguas de ese perfil. Recargar refleja el estado en la interfaz. Si se vuelve al entorno de pruebas, restaurar el config anterior; su endpoint `/api/test` permanece aislado y no depende de la selección de producción. Los proxies antiguos `/api/sheets` y `/api/calendar` ahora delegan solo lecturas a la política exacta de pruebas y rechazan escrituras genéricas; no pueden saltarse la puerta de activación de producción. La configuración protegida nunca los utiliza.

## Verificación

`node --test sandbox/*.test.cjs` cubre los perfiles con Google simulado, incluyendo destinos cruzados, concurrencia, fechas e importes nativos, excepciones de precio/barrio/dirección, pago, papelera/restauración, Calendar de solo lectura y la interfaz con TEST_MODE=false.

`node sandbox/preview-production.cjs` ofrece una vista local en http://localhost:3011, sin conexión a Google, con escrituras desactivadas. Sirve el HTML y panel reales, configuración production y un backend simulado. No acredita por sí solo un ensayo autenticado contra Google.
