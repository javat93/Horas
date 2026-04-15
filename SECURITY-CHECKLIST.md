# Checklist de Seguridad para GitHub Pages

## Acciones Inmediatas Requeridas

### 1. Actualizar URLs del Proxy
- [ ] Reemplazar `https://tu-backend-vercel.vercel.app` con tu URL real del backend
- [ ] Desplegar el backend en Vercel/Netlify/Render
- [ ] Configurar variables de entorno en el servicio de hosting

### 2. Variables de Entorno Obligatorias
```bash
GOOGLE_API_KEY=tu_api_key_aqui
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
SPREADSHEET_ID=1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60
ALLOWED_ORIGINS=https://javat93.github.io,http://localhost:3000
NODE_ENV=production
```

### 3. Verificación de Seguridad
- [ ] Confirmar que `config.secure.js` está en `.gitignore`
- [ ] Verificar que no hay API keys expuestas en el código
- [ ] Probar que el proxy funciona correctamente
- [ ] Validar headers de seguridad en producción

## Mejoras Implementadas

### Headers de Seguridad
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content Security Policy configurado
- HSTS (HTTP Strict Transport Security)

### Rate Limiting
- 100 peticiones por IP cada 15 minutos
- Protección contra ataques de fuerza bruta

### CORS Seguro
- Orígenes permitidos configurados
- Validación de origen en producción
- Logs de todas las peticiones

### GitHub Actions
- Escaneo automático de vulnerabilidades
- Detección de API keys expuestas
- Verificación de configuración de seguridad

## Pasos para Despliegue

1. **Desplegar Backend**:
   ```bash
   cd api
   npm install
   # Subir a Vercel/Netlify/Render
   ```

2. **Configurar Variables de Entorno** en el servicio de hosting

3. **Actualizar URLs** en `config.production.js`

4. **Probar Producción**:
   - Verificar que las APIs funcionan a través del proxy
   - Confirmar que no hay errores de CORS
   - Validar headers de seguridad

## Monitoreo de Seguridad

- Revisar logs del proxy regularmente
- Monitorear uso de APIs
- Actualizar dependencias
- Verificar GitHub Actions security scans

## Contacto de Emergencia

Si detectas alguna vulnerabilidad:
1. Revoca las API keys inmediatamente
2. Revisa los logs del proxy
3. Actualiza las variables de entorno
4. Notifica al equipo de seguridad
