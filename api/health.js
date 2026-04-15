// Health endpoint simple para Vercel
module.exports = (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'production',
    message: 'Vercel proxy funciona!'
  });
};
