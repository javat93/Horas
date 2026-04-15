// Versión simplificada del proxy para probar
module.exports = (req, res) => {
  // Health check
  if (req.url === '/api/health' || req.url === '/health') {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: 'production'
    });
    return;
  }

  // OAuth config
  if (req.url === '/api/oauth-config' || req.url === '/oauth-config') {
    res.json({ 
      client_id: process.env.GOOGLE_CLIENT_ID || '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',
      scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets'
    });
    return;
  }

  res.status(404).json({ error: 'Endpoint not found' });
};
