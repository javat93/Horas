// Google Sheets proxy endpoint
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
    const { GOOGLE_API_KEY, SPREADSHEET_ID } = process.env;
    
    if (!GOOGLE_API_KEY || !SPREADSHEET_ID) {
      return res.status(500).json({ error: 'Missing required environment variables' });
    }

    // Obtener método y parámetros del request body
    const { method, params, body } = req.body || {};

    // Construir URL para Google Sheets API
    const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    let url = `${baseUrl}/${SPREADSHEET_ID}`;

    // Añadir método específico
    if (method === 'get') {
      url += `/values/${params.range}`;
    } else if (method === 'update') {
      url += `/values/${params.range}`;
    } else if (method === 'append') {
      url += `/values/${params.range}:append`;
    } else if (method === 'batchUpdate') {
      url += `:batchUpdate`;
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

    // Configurar request
    const fetchOptions = {
      method: method === 'get' ? 'GET' : 'POST',
      headers: {
        'Authorization': `Bearer ${GOOGLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    // Añadir body para métodos POST
    if (method !== 'get' && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Hacer request a Google Sheets API
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Google Sheets API error' });
    }

    res.json(data);
  } catch (error) {
    console.error('Sheets proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
