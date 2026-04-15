// Google Sheets proxy endpoint
module.exports = async (req, res) => {
  // Test simple para verificar que el endpoint se está ejecutando
  console.log('=== SHEETS ENDPOINT CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.keys(req.headers));
  
  // Configurar CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled');
    res.status(200).end();
    return;
  }

  try {
    // Logging para depuración
    console.log('Sheets proxy request:', { method: req.method, body: req.body });
    
    // Configuración desde variables de entorno
    const { GOOGLE_API_KEY, SPREADSHEET_ID } = process.env;
    
    console.log('Environment check:', { 
      hasApiKey: !!GOOGLE_API_KEY, 
      hasSpreadsheetId: !!SPREADSHEET_ID,
      spreadsheetId: SPREADSHEET_ID
    });
    
    if (!GOOGLE_API_KEY || !SPREADSHEET_ID) {
      console.error('Missing environment variables:', { GOOGLE_API_KEY: !!GOOGLE_API_KEY, SPREADSHEET_ID: !!SPREADSHEET_ID });
      return res.status(500).json({ error: 'Missing required environment variables' });
    }

    // Validar que req.body exista
    if (!req.body) {
      console.error('Request body is missing');
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Obtener método y parámetros del request body
    const { method, params, body } = req.body;

    console.log('Parsed request data:', { method, hasParams: !!params, hasBody: !!body });

    // Validar método
    if (!method) {
      console.error('Method is missing from request');
      return res.status(400).json({ error: 'Method is required' });
    }

    // Validar params para métodos que lo requieren
    if (!params && (method === 'get' || method === 'update' || method === 'append')) {
      console.error('Params are missing for method:', method);
      return res.status(400).json({ error: 'Params are required for this method' });
    }

    // Construir URL para Google Sheets API
    const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    let url = `${baseUrl}/${SPREADSHEET_ID}`;

    // Añadir método específico
    if (method === 'get') {
      if (!params.range) {
        return res.status(400).json({ error: 'Range is required for get method' });
      }
      url += `/values/${params.range}`;
    } else if (method === 'update') {
      if (!params.range) {
        return res.status(400).json({ error: 'Range is required for update method' });
      }
      url += `/values/${params.range}`;
    } else if (method === 'append') {
      if (!params.range) {
        return res.status(400).json({ error: 'Range is required for append method' });
      }
      url += `/values/${params.range}:append`;
    } else if (method === 'batchUpdate') {
      url += `:batchUpdate`;
      // Para batchUpdate, los parámetros van en el body, no en query string
      if (!body || !body.requests) {
        return res.status(400).json({ error: 'Requests array is required for batchUpdate method' });
      }
    } else {
      return res.status(400).json({ error: `Unsupported method: ${method}` });
    }

    // Construir query parameters
    const queryParams = new URLSearchParams();
    if (method === 'get') {
      // Para get, los params van en la URL
      Object.keys(params).forEach(key => {
        if (key !== 'range') queryParams.append(key, params[key]);
      });
    } else if (method === 'update' || method === 'append') {
      queryParams.append('valueInputOption', params.valueInputOption || 'USER_ENTERED');
      if (method === 'append') {
        queryParams.append('insertDataOption', params.insertDataOption || 'INSERT_ROWS');
      }
    }

    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    // Configurar request - usar token de OAuth del header Authorization
    const fetchOptions = {
      method: method === 'get' ? 'GET' : method === 'update' ? 'PUT' : 'POST',
      headers: {
        'Authorization': req.headers.authorization || `Bearer ${GOOGLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    // Añadir body para métodos POST
    if (method !== 'get' && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    console.log('Sheets proxy fetching:', { 
      url, 
      method: fetchOptions.method, 
      hasBody: !!body,
      hasAuth: !!req.headers.authorization
    });

    // Hacer request a Google Sheets API
    const response = await fetch(url, fetchOptions);
    
    console.log('Sheets proxy response:', { 
      status: response.status, 
      ok: response.ok,
      contentType: response.headers.get('content-type')
    });

    // Verificar si la respuesta es HTML (error 404 o página de error)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.error('Received HTML instead of JSON - possible routing error');
      return res.status(500).json({ 
        error: 'Proxy routing error - received HTML instead of JSON',
        details: 'The endpoint may not be properly configured in Vercel',
        url: url
      });
    }

    // Intentar parsear JSON solo si es JSON
    let data;
    try {
      const responseText = await response.text();
      console.log('Response text preview:', responseText.substring(0, 200));
      
      if (!responseText.trim()) {
        return res.status(500).json({ 
          error: 'Empty response from Google Sheets API',
          url: url
        });
      }
      
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return res.status(500).json({ 
        error: 'Invalid JSON response from Google Sheets API',
        details: parseError.message,
        url: url
      });
    }

    if (!response.ok) {
      console.error('Google Sheets API error:', data);
      
      // Si es 404, podría ser range inválido
      if (response.status === 404) {
        console.error('Possible invalid range or spreadsheet ID');
        return res.status(404).json({ 
          error: 'Google Sheets API not found - check spreadsheet ID and range',
          details: {
            spreadsheetId: SPREADSHEET_ID,
            range: params.range,
            url: url,
            googleError: data
          }
        });
      }
      
      return res.status(response.status).json({ 
        error: data.error?.message || data.message || 'Google Sheets API error',
        details: data
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Sheets proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
};
