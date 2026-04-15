# 🛡️ Guía de Seguridad para PercuManager

## Problema Actual
Las API keys de Google están expuestas en el frontend, lo cual es un riesgo de seguridad al desplegar en GitHub Pages.

## Solución Implementada

### 1. Sistema de Configuración Segura

**Archivos creados:**
- `config.secure.js` - Contiene las API keys (NO subir a GitHub)
- `config.production.js` - Configuración para producción sin claves
- `api/proxy.js` - Backend que protege las API keys

### 2. Backend Proxy

**Características:**
- Intercepta todas las llamadas a Google APIs
- Mantiene las API keys seguras en variables de entorno
- Proporciona endpoints para Maps, Sheets, Calendar y OAuth
- Logging de todas las peticiones

### 3. Configuración por Ambiente

**Desarrollo Local:**
```javascript
// Usa `config.secure.js` directamente
// Llama a las APIs de Google directamente
```

**Producción (GitHub Pages):**
```javascript
// Usa `config.production.js` 
// Todas las llamadas van a través del proxy
// Las API keys no se exponen
```

## 🚀 Despliegue Seguro

### Paso 1: Configurar Variables de Entorno

En tu servicio de hosting (Vercel/Netlify/Render):

```bash
GOOGLE_API_KEY=tu_api_key_aqui
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
SPREADSHEET_ID=1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60
NODE_ENV=production
```

### Paso 2: Desplegar Backend

```bash
cd api
npm install
npm deploy  # Vercel: vercel --prod
            # Netlify: netlify deploy --prod
            # Render: git push a main
```

### Paso 3: Actualizar URLs del Proxy

En `config.production.js`, actualiza las URLs:

```javascript
PROXY_URL: 'https://tu-backend-desplegado.vercel.app',
GOOGLE_MAPS_API_URL: 'https://tu-backend-desplegado.vercel.app/api/maps',
// ... etc
```

### Paso 4: Desplegar Frontend

```bash
# Cambiar el script de configuración en index.html
<!-- Para producción -->
<script src="config.production.js"></script>

<!-- Para desarrollo -->
<script src="config.secure.js"></script>
```

## 📋 Estructura de Archivos

```
├── config.secure.js          # 🔒 API keys (NO subir)
├── config.production.js     # 🌐 Config producción segura
├── api/
│   ├── proxy.js             # 🛡️ Backend seguro
│   └── package.json         # 📦 Dependencias
└── README-SECURITY.md       # 📖 Esta guía
```

## 🔐 Beneficios de Seguridad

1. **API Keys Protegidas**: Nunca se exponen en el cliente
2. **Control Centralizado**: Todas las APIs pasan por el proxy
3. **Logging**: Registro de todas las peticiones API
4. **Variables de Entorno**: Sin claves en el código
5. **Flexibilidad**: Fácil cambiar claves sin re-deploy

## 🚨 Consideraciones Importantes

- **Nunca subir** `config.secure.js` a Git
- **Añadir a .gitignore**: `config.secure.js` y `.env`
- **HTTPS obligatorio**: El proxy debe usar HTTPS
- **Rate Limiting**: Considerar límites en el proxy
- **Monitoreo**: Revisar logs del proxy regularmente

## 🔧 Comandos Útiles

```bash
# Iniciar desarrollo
cd api && npm run dev

# Desplegar producción
cd api && npm run build && npm deploy

# Ver logs
vercel logs  # O netlify logs, render logs
```

## 📞 Soporte

Si tienes problemas con el despliegue seguro:

1. Verifica las variables de entorno
2. Confirma las URLs del proxy
3. Revisa los logs del backend
4. Valida que el frontend use `config.production.js`

---

**⚡ Recomendación**: Usa Vercel para el backend por su integración con variables de entorno y despliegue automático.
