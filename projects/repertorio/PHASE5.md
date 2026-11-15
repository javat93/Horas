# Fase 5 completada: repertorio en el original

Fecha: 15/11/2026, Europe/Madrid. El usuario autorizó expresamente el respaldo y la migración del repertorio validado a la aplicación original, sin cambiar Detalle, sesiones o Calendar.

## Acceso y maestro

[Abrir Repertorio](https://javat93.github.io/Horas/repertorio.html). El acceso está en la navegación de Horas y también se ha incorporado al index.html del proyecto local original. Conecta Google, elige Slap Lunes o La Maquinista y gestiona catálogo y seguimiento. La sesión pide solo Sheets, mantiene el token en memoria y no utiliza operaciones de sesiones o Calendar.

El libro original es el único maestro. La copia de desarrollo conserva el piloto como archivo; su servidor local se ha reiniciado sin --write y verifica writeEnabled=false. No existe sincronización bidireccional ni una carga automática posterior desde desarrollo. El consentimiento de Google se ha comprobado desde el dominio habitual de GitHub Pages; no se ha ampliado la configuración de OAuth de Google Cloud.

## Respaldo previo

Se creó una copia nativa reciente y distinta del original: [respaldo anterior a la migración](https://docs.google.com/spreadsheets/d/15nQWzwWX8jUFSfXeTkZx9-J0u7snzMlXxn7o4_Y0GdA/edit?usp=drivesdk). Se verificaron las seis pestañas anteriores con sus identificadores, dimensiones y configuración. La fecha de modificación del original permaneció en 2026-11-15T20:44:26.392Z entre la lectura anterior y posterior al respaldo. No se reconstruyó el libro ni se exportó/importó por Excel.

Además, antes de editar el código local se guardaron y verificaron copias de index.html, los dos servidores modificados y map-picker.js/css fuera del repositorio, en la carpeta phase5-original-code de los artefactos de este chat. Las modificaciones previas del usuario siguen en sus archivos; la única variación del index local es el acceso y el ajuste de su barra de navegación. Los servidores y mapas anteriores se compararon por contenido y permanecen idénticos a ese respaldo.

## Migración ejecutada

- Origen: desarrollo 1oC7oISLsgDUlNEbx69HmAv04ztLweacmPpZtT6w1Y6k.
- Destino: original 1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60.
- Nuevas pestañas: Temas, sheetId 155111501, y GrupoTemas, sheetId 155111502. Los IDs se reservaron tras confirmar que no existían; son distintos de los del ensayo.
- Preparación nativa: dos pestañas de 1001 filas, cabeceras, casillas, filtros, formatos, validaciones y avisos de protección; las 42 peticiones de estructura/plantilla solo mencionaron los dos nuevos sheetId.
- Dry-run fresco: 21 temas y 15 relaciones; ningún conflicto, DEMO, duplicado o referencia huérfana. Se validaron los grupos contra Coles del original actual.
- Carga: Temas!A2:H22 y GrupoTemas!A2:M16, 36 actualizaciones de fila en un único lote. Se conservaron los UUID, órdenes, variantes, notas, booleanos y fechas. NombreTema se reconstruyó con búsqueda exacta sobre el catálogo del propio destino.
- Relectura por ID y verificación de las fórmulas calculadas completadas. La repetición no escribió filas ni duplicó relaciones. El origen no cambió durante la migración.

Slap Lunes conserva 10 temas. La Maquinista conserva 5. Realizado y Repasando permanecen desmarcados y las fechas de aprendizaje vacías porque el usuario no aportó esos estados. Migrar el repertorio no implica afirmar que los temas estén aprendidos.

La presentación de GrupoTemas se ajustó solo en las nuevas celdas: notas con ajuste de texto y columna ActualizadoEn ampliada. Las dos pestañas nuevas se revisaron visualmente en Google Sheets al 100%.

## Activación y pruebas

La API productiva es /api/repertorio, fijada al original y a los dos sheetId nuevos. La API de desarrollo mantiene su destino propio. Una solicitud de cliente no puede elegir otro libro, perfil, rango o acción de Calendar. Los módulos comparten modelo y servicio mediante perfiles fijados en servidor; no se cambiaron las políticas heredadas.

Se publicó primero con migrationVerified=true y writeEnabled=false. Desde la app real de GitHub Pages se comprobó Google conectado y la lectura de La Maquinista con los controles de escritura deshabilitados. Después se habilitó writeEnabled=true en release/repertoire-activation.json y se verificó el nuevo entorno publicado.

Desde el navegador se guardó una nota temporal en La Maquinista/Batucada. Una lectura independiente del original confirmó su persistencia y que Realizado/Repasando no cambiaron. La nota real se restauró desde la misma interfaz y se volvió a comprobar en Sheets. No quedan notas temporales ni datos DEMO. ActualizadoEn conserva la hora real de esta comprobación; por ello el recibo de la carga inicial es histórico y no debe usarse para sobrescribir cambios posteriores.

La rama de entrega pasa 249 pruebas, incluidas cinco específicas de producción. La copia local original pasa sus 246 pruebas disponibles. También se verificaron Test isolation, Security Scan, Pages y Vercel de las publicaciones de código. Se incorporaron primero las mejoras recientes de producción para conservar los mapas y formularios publicados.

## Alcance de la conservación

No hubo peticiones de escritura a los seis sheetId anteriores ni llamadas a Calendar. Detalle mantiene sheetId 0, 23884 filas, 29 columnas y su cabecera congelada. Los metadatos de las seis pestañas anteriores coinciden con los anteriores a la migración. La configuración productiva de sesiones, sus banderas, su API y los servicios de Calendar no tienen diferencias frente a la versión publicada previa. No se abrió una sesión del módulo de sesiones para ensayar cambios reales.

La comprobación de conservación se basa en la copia nativa, las barreras y el registro de destinos/rangos de escritura, los metadatos y la comparación del código. No se ha leído ni comparado celda por celda todo Detalle, ni se ha restaurado sobre sus datos.

## Recuperación

Para pausar el módulo, establecer solo writeEnabled=false en release/repertoire-activation.json y publicar. Esto no altera las banderas de sesiones o Calendar ni borra el repertorio. Puede retirarse el acceso de navegación sin tocar los datos.

Los planes y recibos de evidence/phase5-migration-plan.json conservan las celdas anteriores de las filas nuevas. El rollback exige que el destino siga teniendo su huella posterior; la prueba de nota y futuras ediciones la cambian, así que debe detenerse y conciliarse antes de recuperar. No forzar la huella ni borrar hojas a ciegas.

El respaldo completo anterior sirve para consulta/recuperación selectiva, no para sustituir el libro entero después de que sigan cambiando las sesiones reales. Conservar las ediciones posteriores del repertorio antes de cualquier restauración. No usar desarrollo como segundo maestro.

Los commits 5d708c1 y 79b43f6 registran respectivamente la migración/acceso inicial y la habilitación de escritura. La evidencia de cierre complementa los recibos con las verificaciones posteriores del navegador y del código local.
