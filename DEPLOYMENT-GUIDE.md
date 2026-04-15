# Guía de Despliegue Seguro - Paso a Paso

## Paso 1: Instalar Node.js
1. Ve a https://nodejs.org/
2. Descarga la versión LTS (Long Term Support)
3. Ejecuta el instalador
4. Verifica la instalación:
   ```bash
   node --version
   npm --version
   ```

## Paso 2: Preparar el Backend
1. Abre terminal en la carpeta `api`:
   ```bash
   cd c:\Users\Javat\Documents\GitHub\Horas\api
   npm install
   ```

## Paso 3: Crear Cuenta en Vercel
1. Ve a https://vercel.com/
2. Regístrate con tu cuenta de GitHub
3. Conecta tu repositorio `Horas`

## Paso 4: Desplegar Backend en Vercel

### Opción A: Desde VS Code (Recomendado)
1. Instala la extensión de Vercel en VS Code
2. Abre la paleta de comandos (Ctrl+Shift+P)
3. Busca "Vercel: Deploy"
4. Selecciona la carpeta `api`
5. Confirma el despliegue

### Opción B: Desde Terminal
1. Instala Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. En la carpeta `api`:
   ```bash
   vercel login
   vercel --prod
   ```

## Paso 5: Configurar Variables de Entorno en Vercel
1. En el dashboard de Vercel, ve a tu proyecto
2. Ve a "Settings" > "Environment Variables"
3. Añade estas variables:

```
GOOGLE_API_KEY=tu_api_key_aqui
GOOGLE_CLIENT_ID=tu_client_id_aqui  
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
SPREADSHEET_ID=1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60
ALLOWED_ORIGINS=https://javat93.github.io,http://localhost:3000
NODE_ENV=production
```

## Paso 6: Obtener URL del Backend
1. Después del despliegue, Vercel te dará una URL como:
   `https://tu-proyecto-abc123.vercel.app`
2. Copia esta URL

## Paso 7: Actualizar config.production.js
Reemplaza las URLs del proxy con tu URL real:

```javascript
PROXY_URL: 'https://tu-proyecto-abc123.vercel.app',
GOOGLE_MAPS_API_URL: 'https://tu-proyecto-abc123.vercel.app/api/maps',
GOOGLE_SHEETS_API_URL: 'https://tu-proyecto-abc123.vercel.app/api/sheets',
GOOGLE_CALENDAR_API_URL: 'https://tu-proyecto-abc123.vercel.app/api/calendar'
```

## Paso 8: Probar el Proxy
1. Abre en navegador: `https://tu-proyecto-abc123.vercel.app/api/health`
2. Deberías ver:
   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "environment": "production"
   }
   ```

## Paso 9: Actualizar GitHub Pages
1. Commit y push los cambios:
   ```bash
   git add .
   git commit -m "Implementar seguridad y proxy"
   git push origin main
   ```
2. GitHub Pages se actualizará automáticamente

## Paso 10: Verificación Final
1. Visita tu GitHub Pages
2. Abre DevTools (F12)
3. Ve a la pestaña "Network"
4. Verifica que las llamadas a APIs van a tu proxy de Vercel
5. Confirma que no hay API keys expuestas

## Troubleshooting

### Si npm no funciona:
- Reinicia tu terminal
- Verifica que Node.js está en el PATH
- Reinicia tu computadora si es necesario

### Si el proxy no funciona:
- Revisa las variables de entorno en Vercel
- Verifica los logs en Vercel dashboard
- Confirma las URLs en config.production.js

### Si hay errores de CORS:
- Verifica ALLOWED_ORIGINS en Vercel
- Confirma que tu GitHub Pages URL está incluida

## Comandos Útiles

```bash
# Ver logs de Vercel
vercel logs

# Redesplegar backend
vercel --prod

# Probar localmente
cd api && npm run dev
```

## Checklist Final
- [ ] Node.js instalado
- [ ] Backend desplegado en Vercel
- [ ] Variables de entorno configuradas
- [ ] URLs del proxy actualizadas
- [ ] GitHub Pages actualizado
- [ ] Sin API keys expuestas
- [ ] Todo funciona en producción
