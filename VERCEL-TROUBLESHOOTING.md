# Guía de Solución de Problemas en Vercel

## Problema: Error 401 No Autorizado (SSO Authentication)

El deployment está requiriendo autenticación SSO. Esto impide que el frontend pueda acceder al proxy.

## Soluciones (en orden de prioridad)

### 1. Hacer el proyecto público (recomendado para testing)

1. Ve al dashboard de Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto `horas-fkpu9s7du-javat93s-projects`
3. Click en "Settings" tab
4. Ve a "Advanced" section
5. Cambia "Visibility" de "Private" a "Public"
6. Guarda los cambios
7. Espera a que se complete el nuevo deployment

### 2. Verificar variables de entorno

Asegúrate de que todas estas variables estén configuradas en Vercel Settings > Environment Variables:

```
GOOGLE_API_KEY=tu_api_key_real
GOOGLE_CLIENT_ID=tu_client_id_real  
GOOGLE_CLIENT_SECRET=tu_client_secret_real
SPREADSHEET_ID=1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60
ALLOWED_ORIGINS=https://javat93.github.io,http://localhost:3000
NODE_ENV=production
```

### 3. Forzar un nuevo deployment

1. En el dashboard de Vercel, ve a "Deployments"
2. Encuentra el deployment más reciente
3. Click en los tres puntos (···) y selecciona "Redeploy"
4. Espera a que complete

### 4. Probar endpoints manualmente

Una vez que el proyecto sea accesible, prueba estos endpoints:

```bash
# Health check
curl https://horas-fkpu9s7du-javat93s-projects.vercel.app/api/health

# Google Maps proxy
curl "https://horas-fkpu9s7du-javat93s-projects.vercel.app/api/maps?libraries=places&callback=initMap"
```

## Configuración del Dominio Personalizado

Si quieres usar `horas-ten.vercel.app`:

1. Ve a "Settings" > "Domains"
2. Añade `horas-ten.vercel.app`
3. Configura los registros DNS según las instrucciones de Vercel
4. Espera la propagación DNS (puede tardar hasta 24 horas)

## Pruebas Locales (requiere Node.js)

Para probar el backend localmente:

```bash
# 1. Instalar Node.js desde https://nodejs.org
# 2. Instalar dependencias
npm install

# 3. Crear archivo .env con las variables
cp .env.example .env
# Editar .env con tus valores reales

# 4. Iniciar el servidor
npm start

# 5. Probar endpoints localmente
curl http://localhost:3000/api/health
```

## Verificación Final

Una vez que Vercel sea accesible:

1. Abre tu GitHub Pages: https://javat93.github.io/Horas/
2. Abre las herramientas de desarrollador (F12)
3. Ve a la pestaña "Network"
4. Intenta sincronizar datos
5. Verifica que las llamadas se hagan a `https://horas-fkpu9s7du-javat93s-projects.vercel.app/api/*`
6. Confirma que no hay llamadas directas a Google APIs

## Si nada funciona

Si después de intentar todo esto el problema persiste:

1. Contacta a Vercel support sobre el error 401
2. Considera usar Netlify o Render como alternativas
3. Revisa los logs de deployment en Vercel para errores específicos
