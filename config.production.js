// CONFIGURACIÓN PARA PRODUCCIÓN - SEGURO
// Este archivo no contiene claves API - usa proxy

const CONFIG = {
    // En producción, estas claves NO se exponen - se manejan en el backend
    API_KEY: null, // Nunca exponer en producción
    CLIENT_ID: null, // Nunca exponer en producción
    SPREADSHEET_ID: '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60',
    SCOPES: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets',
    DISCOVERY_DOCS: [
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
        'https://sheets.googleapis.com/$discovery/rest?version=v4'
    ],
    
    // URLs del proxy para producción - URLs REALES de Vercel (usar main branch)
    PROXY_URL: 'https://horas-git-main-javat93s-projects.vercel.app',
    GOOGLE_MAPS_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/maps',
    GOOGLE_SHEETS_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/sheets',
    GOOGLE_CALENDAR_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/calendar',
    
    // Configuración de seguridad
    USE_PROXY: true, // Forzar uso de proxy en producción
    ENVIRONMENT: 'production'
};
