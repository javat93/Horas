// CONFIGURACIÓN PARA PRODUCCIÓN - SEGURO
// Este archivo no contiene claves API sensibles - usa proxy para llamadas a APIs

const CONFIG = {
    // En producción, API_KEY NO se expone - se maneja en el backend
    API_KEY: null, // Nunca exponer en producción
    // CLIENT_ID sí es necesario para OAuth en el frontend (no es secreto)
    CLIENT_ID: '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',
    SPREADSHEET_ID: '1breBD5aoBR4i9yiPJUKZC2Ouk0rvFOlRmwgJk4bUPwI',
    SPREADSHEET_NAME: 'Horas Fran — PRUEBAS — 28-10-2026',
    TEST_MODE: true,
    TEST_PHASE: 8,
    STATE_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=state',
    GROUPS_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=groups',
    LOCALE_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=locale',
    PROTECTED_REVIEW_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=protected',
    CALENDAR_LINKS_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=links',
    SCOPES: 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/spreadsheets',
    DISCOVERY_DOCS: [
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
        'https://sheets.googleapis.com/$discovery/rest?version=v4'
    ],
    
    // URLs del proxy para producción - URLs REALES de Vercel (usar main branch)
    PROXY_URL: 'https://horas-git-main-javat93s-projects.vercel.app',
    GOOGLE_MAPS_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/maps',
    GOOGLE_SHEETS_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=sheets',
    GOOGLE_CALENDAR_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=calendar',
    TEST_ENVIRONMENT_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=environment',
    TEST_CONTROL_API_URL: 'https://horas-git-main-javat93s-projects.vercel.app/api/test?api=control',
    
    // Configuración de seguridad
    USE_PROXY: true, // Forzar uso de proxy en producción
    ENVIRONMENT: 'production'
};
