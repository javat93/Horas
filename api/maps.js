// Google Maps proxy endpoint
module.exports = (req, res) => {
  try {
    // Configuración desde variables de entorno
    const { GOOGLE_API_KEY } = process.env;
    
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_API_KEY environment variable' });
    }

    // Obtener parámetros de la query
    const { libraries, callback } = req.query;

    // Construir URL para Google Maps API
    const url = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=${libraries || 'places'}&callback=${callback || ''}`;

    // Redirigir a Google Maps API
    res.redirect(url);
  } catch (error) {
    console.error('Maps proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
