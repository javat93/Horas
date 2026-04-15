// Google Maps proxy endpoint
module.exports = async (req, res) => {
  try {
    // Configuración CORS para permitir acceso desde GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Configuración desde variables de entorno
    const { GOOGLE_API_KEY } = process.env;
    
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_API_KEY environment variable' });
    }

    // Obtener parámetros de la query
    const { libraries, callback } = req.query;

    // Construir URL para Google Maps API
    const url = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=${libraries || 'places'}&callback=${callback || ''}`;

    // Fetch del script de Google Maps API
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).send('Error loading Google Maps API');
    }

    // Obtener el contenido del script
    const scriptContent = await response.text();
    
    // Servir el contenido con el content-type apropiado
    res.setHeader('Content-Type', 'application/javascript');
    res.send(scriptContent);
  } catch (error) {
    console.error('Maps proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
