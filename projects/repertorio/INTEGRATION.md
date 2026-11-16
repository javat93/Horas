# Repertorio integrado en PercuManager

16/11/2026. Corrige la separación visual y de conexión de la primera entrega.

Repertorio se monta dentro de index.html, en la cuarta sección de la navegación principal. Mantiene el logo de La Galeta, la cabecera y el menú Lista / Calendario / Grupos / Repertorio. Por grupo, Catálogo y Resumen son controles internos superiores, sin otro menú inferior. Actualizar repertorio en la cabecera recarga únicamente este módulo; las acciones de sincronizar sesiones e importar Calendar vuelven al salir de Repertorio.

La interfaz comparte la sesión principal mediante funciones locales: valida el modo productivo, el ID fijo del original, el permiso de Sheets y la caducidad, y obtiene el token vigente del gestor de acceso existente en cada petición. No crea otra clave de almacenamiento, no transmite tokens entre ventanas, no inicia un cliente OAuth adicional y no solicita permisos nuevos. Si caduca o se invalida la sesión, se utiliza la renovación normal de la aplicación. Desarrollo conserva su acceso independiente y su copia.

La vista reutiliza el mismo renderizador en una raíz de componentes con estilos acotados, para evitar que los estilos de formularios o tarjetas alteren el resto de la app. Se mantiene montada al cambiar de sección y conserva el grupo elegido. Los enlaces repertorio.html#grupo=… redirigen a index.html#repertorio&grupo=… conservando el grupo.

Los endpoints, políticas de destino, modelo de datos, protecciones de concurrencia y configuración de Google permanecen intactos. Las escrituras de repertorio siguen limitadas a Temas y GrupoTemas. No se han modificado datos reales de sesiones, repertorio ni Calendar durante este trabajo.

## Validación

253 pruebas aprobadas: se añaden pruebas de reutilización y renovación de la sesión, rechazo de conexiones caducadas, de otros entornos/libros y sin Sheets, y conservación de enlaces con caracteres especiales.

Recorrido en navegador con datos ficticios en memoria: entrada desde Lista sin OAuth adicional, ida y vuelta conservando conexión y grupo, actualización desde la cabecera, marcado independiente de Ya lo saben y Repasando, notas sin fechas, catálogo, enlace antiguo y cuatro tamaños (320, 390, 768 y 1280 px). Un solo logo, un único menú inferior, casillas de 48 px y ausencia de desbordamiento horizontal. La prueba de guardado solo afecta al simulador.

No se ha iniciado una nueva sesión real de Google ni ejecutado sincronizaciones de sesiones o Calendar para estas pruebas. El despliegue se comprueba comparando los archivos públicos con la entrega.
