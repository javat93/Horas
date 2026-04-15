// Health endpoint simple para Vercel
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
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'production',
    message: 'Vercel proxy funciona!'
  });
};
