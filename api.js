// Backend Proxy para Google APIs - Protege las API keys
// Desplegar en Vercel/Netlify/Render

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Deployment: 2025-04-15 - Proxy seguro para Google APIs

const app = express();

// Headers de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://maps.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://maps.googleapis.com", "https://sheets.googleapis.com", "https://www.googleapis.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por IP
  message: { error: 'Too many requests' }
});
app.use(limiter);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://javat93.github.io'],
  credentials: true
}));
app.use(express.json());

// Configuración desde variables de entorno
const { 
  GOOGLE_API_KEY, 
  GOOGLE_CLIENT_ID,
  SPREADSHEET_ID,
  NODE_ENV 
} = process.env;

// Middleware para logging y validación de origen
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://javat93.github.io'];
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${origin || 'direct'}`);
  
  // Validación adicional de origen en producción
  if (process.env.NODE_ENV === 'production' && origin && !allowedOrigins.includes(origin)) {
    console.warn(`Unauthorized origin: ${origin}`);
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  next();
});

// Proxy para Google Maps API
app.get('/api/maps', async (req, res) => {
  try {
    const { libraries, callback } = req.query;
    const url = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=${libraries || 'places'}&callback=${callback || ''}`;
    
    // Redirigir a Google Maps con la API key segura
    res.redirect(url);
  } catch (error) {
    console.error('Maps proxy error:', error);
    res.status(500).json({ error: 'Error loading Maps API' });
  }
});

// Proxy para Google Sheets API
app.post('/api/sheets/*', async (req, res) => {
  try {
    const { path } = req.params;
    const { method, body, params } = req.body;
    
    const auth = new google.auth.GoogleAuth({
      apiKey: GOOGLE_API_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    let result;
    switch (method) {
      case 'get':
        result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: params.range
        });
        break;
      case 'update':
        result = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: params.range,
          valueInputOption: params.valueInputOption || 'USER_ENTERED',
          resource: body
        });
        break;
      case 'append':
        result = await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: params.range,
          valueInputOption: params.valueInputOption || 'USER_ENTERED',
          insertDataOption: params.insertDataOption || 'INSERT_ROWS',
          resource: body
        });
        break;
      case 'batchUpdate':
        result = await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: body
        });
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
    
    res.json(result.data);
  } catch (error) {
    console.error('Sheets proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy para Google Calendar API
app.post('/api/calendar/*', async (req, res) => {
  try {
    const { path } = req.params;
    const { method, body, params } = req.body;
    
    const auth = new google.auth.GoogleAuth({
      apiKey: GOOGLE_API_KEY,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    let result;
    switch (method) {
      case 'list':
        result = await calendar.events.list({
          calendarId: 'primary',
          ...params
        });
        break;
      case 'insert':
        result = await calendar.events.insert({
          calendarId: 'primary',
          resource: body
        });
        break;
      case 'delete':
        result = await calendar.events.delete({
          calendarId: 'primary',
          eventId: params.eventId
        });
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
    
    res.json(result.data);
  } catch (error) {
    console.error('Calendar proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy para Google OAuth
app.post('/api/oauth/*', async (req, res) => {
  try {
    const { path } = req.params;
    const { body } = req.body;
    
    const auth = new google.auth.GoogleAuth({
      apiKey: GOOGLE_API_KEY,
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets']
    });

    // Para autenticación OAuth2
    if (path === 'token') {
      const { client } = require('google-auth-library');
      const oauth2Client = new client.OAuth2Client(
        GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${req.protocol}://${req.get('host')}/oauth/callback`
      );
      
      // Aquí manejarías el flujo OAuth completo
      res.json({ message: 'OAuth endpoint - implementar flujo completo' });
    }
  } catch (error) {
    console.error('OAuth proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV 
  });
});

// Servir archivos estáticos (para producción)
if (NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV || 'development'}`);
});
