# Fase 6 — Adaptación móvil y visual

Cerrada el 16/11/2026. La prioridad de diseño es el uso en móvil, que representa aproximadamente el 90% del uso indicado por el usuario. Se conserva la adaptación a tableta y escritorio.

## Cambios

- Navegación inferior en móvil: Por grupo, Catálogo y Grupos, con iconos y texto.
- Selector de grupo siempre accesible al desplazar la lista; el enlace conserva el grupo al recargar y reconectar Google.
- Cuatro contadores que también filtran: Temas, Ya saben, Por aprender y En repaso.
- Casillas «Ya lo saben» y «Repasando» independientes, con superficies táctiles de 48 px. El texto y las casillas acompañan al color.
- Búsqueda visible y filtros secundarios plegables. Las notas, archivo y selección múltiple se encuentran en los menús de opciones.
- Formularios como paneles inferiores en móvil, con botones accesibles y campos de 16 px. Compatibilidad con márgenes seguros de pantalla.
- Escritorio con navegación superior y filas compactas. Preferencia de movimiento reducido respetada.

No se piden fechas de repaso. No cambia el esquema, la API ni los estados de aprendizaje. Esta fase no escribe datos en Google Sheets ni llama a Calendar. Detalle, las sesiones y la configuración de sus servicios quedan fuera del cambio.

## Comprobación

249 pruebas automáticas aprobadas. Pruebas de interfaz sobre una simulación local en memoria que utiliza el mismo modelo, servicio y handler, con la plantilla visual de producción (`node sandbox/repertoire-preview.cjs --production-layout`). No usa credenciales ni llama a Google.

Revisados 320 × 568, 390 × 844, 430 × 932, 768 × 1024 y 1280 × 900. El ancho del documento coincide con el disponible, sin desbordamiento horizontal. En 320 × 568 el formulario de alta ocupa desde y=12 hasta y=568; Guardar y Cancelar tienen 48 px de alto y permanecen visibles. En las tres vistas de teléfono las casillas principales tienen 48 px de alto. Los menús de opciones tienen objetivos de 44 px. Se comprobaron navegación, filtros por tipo y archivados, restablecimiento y conservación del grupo tras recargar.

También se comprobaron, durante la implementación, asignación de temas, estados independientes entre grupos, selección por lotes, notas sin fechas y menús que se abren hacia arriba cuando falta espacio. Todas las modificaciones de prueba fueron sobre datos ficticios en memoria.

La comprobación responsive utiliza tamaños de navegador; no sustituye una prueba física con teclado de iOS o Android.

El despliegue conserva el original como único maestro y no requiere migración de datos. La reversión consiste en restaurar los archivos de interfaz anteriores, sin restaurar el libro ni modificar los estados de los grupos.
