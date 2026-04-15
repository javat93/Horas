// Google Calendar proxy endpoint
module.exports = async (req, res) => {
  // Configurar CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Configuración desde variables de entorno
    const { GOOGLE_API_KEY } = process.env;
    
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_API_KEY environment variable' });
    }

    // Obtener método y parámetros del request body
    const { method, params, body } = req.body || {};

    // Construir URL para Google Calendar API
    const baseUrl = 'https://www.googleapis.com/calendar/v3';
    let url = '';

    // Añadir método específico
    if (method === 'list') {
      url = `${baseUrl}/calendars/${params.calendarId}/events`;
    } else if (method === 'insert') {
      url = `${baseUrl}/calendars/${params.calendarId}/events`;
    } else if (method === 'delete') {
      url = `${baseUrl}/calendars/${params.calendarId}/events/${params.eventId}`;
    }

    // Construir query parameters
    const queryParams = new URLSearchParams();
    
    if (method === 'list') {
      Object.keys(params).forEach(key => {
        if (key !== 'calendarId') queryParams.append(key, params[key]);
      });
    }

    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    // Configurar request - usar token de OAuth del header Authorization
    const fetchOptions = {
      method: method === 'delete' ? 'DELETE' : 'POST',
      headers: {
        'Authorization': req.headers.authorization || `Bearer ${GOOGLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    // Añadir body para métodos POST
    if (method !== 'list' && method !== 'delete' && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Hacer request a Google Calendar API
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Google Calendar API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('Calendar proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
