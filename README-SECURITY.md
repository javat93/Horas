# Seguridad de PercuManager 1.6.0

- OAuth de Google con caducidad y conexión reutilizada. Sin secreto de cliente en el frontend. Los borradores no contienen tokens.
- Endpoints limitados al libro original, acciones, rangos, campos y versiones. El repertorio no usa operaciones de sesiones/Calendar.
- Revisión previa y relectura posterior. Las escrituras inciertas no se reenvían automáticamente.
- Textos escapados y eventos desde scripts externos; CSP sin scripts inline ni eval.
- security-headers.json define las cabeceras que vercel.json aplica en Vercel. GitHub Pages recibe CSP por meta y no admite cabeceras propias. frame-ancestors no se aplica por meta.
- Google Identity Services se carga desde su origen oficial sin cambiar permisos. Versiones/licencias visuales en vendor/.
- Copias periódicas mediante conector autorizado y automatización de Codex; ningún token de Drive incrustado en la app.
- Ensayos de navegador exclusivamente contra sandbox/preview-production.cjs, sin Google real.
- Nunca publicar config.secure.js, .env ni credenciales. Los IDs públicos de OAuth/libro no autorizan acceso a datos.

Ver projects/improvements/PHASES.md para límites y recuperación.
