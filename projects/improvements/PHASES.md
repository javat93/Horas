# PercuManager 1.6.0 — Mejoras por fases

Fecha: 22/11/2026. Rama feature/phased-improvements, basada en efc84397b0eb73cca42b5a08455bf6101176cd81.

## Fases funcionales
1. **Móvil compacto** (9db5323): controles de curso compactos y organización/actualización plegadas; navegación y logo comunes.
2. **Grupos activos** (6b1d51e): nuevas sesiones priorizan habituales activos; consultar todos es explícito. Editar conserva el grupo histórico.
3. **Borradores** (3ca2169): formularios de sesiones/grupos, marcados/formularios de repertorio y clasificación de curso. Almacenamiento local por libro y entorno, caducidad siete días, recuperación explícita sin envío automático. Se eliminan al verificar o descartar. No contienen tokens.
4. **Curso guiado** (e1f7f2f): primer acceso distinto de filtros sin resultados, selección y clasificación múltiple, copia revisable sin sobrescribir clasificados.
5. **Plantillas** (82511c1): Galeta/Slap/Propios, copia desde otro grupo y personalizadas compartidas en PlantillasRepertorio (155111504). Solo temas activos no asignados, nunca estados aprendidos. Hasta 50 temas por lote. Carga 2 lecturas, guardar 4 lecturas + 1 escritura verificada.
6. **Informes** (856a5e5): presentación de importes por grupo/curso manteniendo reglas y porcentaje existentes. CSV de sesiones, repertorio y grupos; compartir resumen por acción del usuario. Protección de fórmulas CSV.

## Fase técnica conjunta
- Coordinador Google: deduplica lecturas simultáneas, limita a dos peticiones de cliente en vuelo, pausa común de cuota entre módulos/pestañas, tiempos límite y ningún reintento automático de escritura. Conserva 401/429/conflictos.
- Comprobaciones automáticas esperan al fin de una sesión elegible y respetan pestaña oculta, cuota y otras operaciones.
- Repertorio y clasificación escriben solo campos modificados, con comprobación previa y posterior. Web Locks coordina pestañas. El ensayo simultáneo conserva notas/repaso externos y exige revisión si la confirmación difiere. Google Sheets sigue sin exclusión transaccional distribuida frente a otros procesos o editores; no se promete atomicidad de lectura-comprobación-escritura.
- Textos escapados, eventos externos, sin JavaScript inline ni eval. Librerías visuales locales con versiones/licencias fijas.
- CSP por meta efectiva en GitHub Pages y cabeceras HTTP aplicadas mediante vercel.json en Vercel. Pages no admite cabeceras propias; frame-ancestors no se aplica por meta. Se rechaza la ejecución embebida como defensa adicional.
- Código separado en app-main, app-views, app-forms, group-options, red, informes, borradores y plantillas. Pruebas adaptadas a las fuentes reales.
- Versión visible 1.6.0 y manifest coherente. CI móvil sobre simulación aislada con accesos externos bloqueados.
- Copias diarias a las 06:00 Europe/Madrid mediante automatización de Codex, con conector Drive existente. Requiere Codex disponible y conexión operativa. Últimos 14 días en carpeta principal; anteriores archivados, nunca borrados. La app no recibe permisos nuevos de Drive.

## Migración y recuperación
Única pestaña añadida al original: PlantillasRepertorio. Las nueve anteriores conservan estructura. No se clasifican grupos ni marcan temas reales; ninguna prueba escribe sesiones ni llama a Calendar real.

Automatización: copias-diarias-de-percumanager. Los IDs de las copias y del ensayo se conservan en el acta local de entrega.

El ensayo verificó estructura y los rangos Coles!A1:E5, Detalle!A1:O3, Temas!A1:H25, GrupoTemas!A1:M20 y GruposCurso!A1:F15 (valores, formato y validación). No es una comparación exhaustiva. Nunca se sobrescribió el original.

## Referencias
Google Identity CSP: https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
Cabeceras en Pages: https://github.com/orgs/community/discussions/54257

## Validación de entrega
Validación previa a publicación: 296 pruebas Node de la entrega y 293 de la copia local conservando cambios previos, todas correctas. Seis recorridos móviles de CI correctos (320 y 390 px): organización/selector/borrador, plantilla e informes. Revisión visual móvil sin desbordamiento, recuperación tras cuota y CSV descargado en simulación. Test isolation correcto.

La publicación y las verificaciones de activos/API se registran en el acta local de entrega. No se ha probado un consentimiento OAuth nuevo ni realizado escrituras reales de sesiones o Calendar.
