# Diseño móvil del resto de PercuManager

Entregado el 16/11/2026. Continuación del diseño validado del repertorio, con prioridad móvil (aproximadamente el 90% del uso indicado por el usuario).

## Alcance

- Navegación inferior con Lista, Calendario, Grupos y Repertorio; navegación superior en escritorio.
- Tarjetas de sesiones y grupos, importes más legibles, controles de pago/archivo accesibles y filtros plegables cuyo resumen indica el estado elegido. Se conserva el filtro inicial de pendientes.
- Formularios de sesión, grupo e importación y paneles de revisión adaptados como paneles inferiores en móvil, con campos de 16 px, botones amplios, acción principal accesible al desplazar y márgenes seguros.
- Etiquetas de campos, foco dentro de los formularios, cierre sin guardar con Escape y acceso por teclado a las tarjetas.
- Presentación responsive de calendario, mapa y páginas de información, privacidad y condiciones. Los textos legales se conservan.

## Conservación de datos y operaciones

Solo presentación. No se migraron ni editaron datos de Sheets, sesiones, grupos o Calendar. No se modificaron APIs, permisos, configuraciones ni servicios. Los cálculos financieros anteriores son idénticos; solo cambia su HTML. Los cambios en las funciones existentes se limitan al HTML de renderEventos, renderGrupos y updateFinancialStats. app-ui.js no realiza peticiones, no accede al almacenamiento y no cambia valores de los formularios.

Se hizo una copia local del código original antes de editar. En el proyecto original se aplicaron los mismos cambios acotados sobre sus archivos actuales, conservando sus modificaciones previas de mapa y formularios. No se sustituyó la aplicación con una copia antigua.

## Verificación

249 pruebas aprobadas. JavaScript de presentación e inline compilado sin errores. Pruebas en navegador en una simulación en memoria, sin conexión a Google, mediante sandbox/preview-production.cjs.

Lista, Grupos y Calendario revisados a 320 × 568, 390 × 844, 768 × 1024 y 1280 × 900: sin desbordamiento horizontal. Navegación móvil con objetivos de 56 px; escritorio con 48 px. Formularios de sesión/grupo a 320 × 568 con panel desde y=12 hasta y=568 y acción principal visible. Probados filtros, navegación, apertura por teclado, ciclo del foco, Escape, revisión de un alta ficticia y cancelación sin confirmar. El alta no se aplicó. Las tres páginas informativas caben a 320 px.

Las comprobaciones usan tamaños de navegador, no un dispositivo físico iOS/Android. Para verificar producción se compararon los archivos servidos con la entrega; no se abrió una nueva sesión de Google en la aplicación principal durante este trabajo, para evitar que sus automatismos existentes escribieran estados de sesiones.

## Recuperación

Restaurar solo los archivos de interfaz de la versión anterior. No restaurar el libro ni Calendar. El nuevo diseño no exige cambios de esquema ni migración.
