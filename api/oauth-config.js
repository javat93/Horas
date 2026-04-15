// OAuth config endpoint
module.exports = (req, res) => {
  // Configurar CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  res.json({ 
    client_id: process.env.GOOGLE_CLIENT_ID || '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',
    scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets'
  });
};
