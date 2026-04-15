// OAuth config endpoint
module.exports = (req, res) => {
  res.json({ 
    client_id: process.env.GOOGLE_CLIENT_ID || '367465910816-1epkiok8ntvrphrv08b4g6amh0u9knpv.apps.googleusercontent.com',
    scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets'
  });
};
