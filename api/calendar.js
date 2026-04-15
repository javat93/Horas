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

    // Logging para depuración
    console.log('Calendar proxy request:', { method, params, body: body ? 'present' : 'missing' });

    // Validar que se proporcionó un método
    if (!method) {
      return res.status(400).json({ error: 'Missing method parameter' });
    }

    // Construir URL para Google Calendar API
    const baseUrl = 'https://www.googleapis.com/calendar/v3';
    let url = '';

    // Añadir método específico
    if (method === 'list') {
      if (!params || !params.calendarId) {
        return res.status(400).json({ error: 'Missing calendarId for list method' });
      }
      url = `${baseUrl}/calendars/${params.calendarId}/events`;
    } else if (method === 'insert') {
      if (!params || !params.calendarId) {
        return res.status(400).json({ error: 'Missing calendarId for insert method' });
      }
      if (!body) {
        return res.status(400).json({ error: 'Missing body for insert method' });
      }
      url = `${baseUrl}/calendars/${params.calendarId}/events`;
    } else if (method === 'delete') {
      if (!params || !params.calendarId || !params.eventId) {
        return res.status(400).json({ error: 'Missing calendarId or eventId for delete method' });
      }
      url = `${baseUrl}/calendars/${params.calendarId}/events/${params.eventId}`;
    } else {
      return res.status(400).json({ error: `Unsupported method: ${method}` });
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

    console.log('Calendar proxy fetching:', { url, method: fetchOptions.method, hasBody: !!body });

    // Hacer request a Google Calendar API
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    console.log('Calendar proxy response:', { status: response.status, ok: response.ok });

    if (!response.ok) {
      console.error('Google Calendar API error:', data);
      return res.status(response.status).json({ 
        error: data.error || data.message || 'Google Calendar API error',
        details: data
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Calendar proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
