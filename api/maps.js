// Google Maps proxy endpoint
module.exports = (req, res) => {
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

    // Decodificar el callback si está codificado
    const decodedCallback = callback ? decodeURIComponent(callback) : '';

    // Construir URL para Google Maps API con callback decodificado
    const url = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=${libraries || 'places'}&callback=${decodedCallback}`;

    // Redirigir a Google Maps API (con CORS headers)
    res.redirect(302, url);
  } catch (error) {
    console.error('Maps proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
