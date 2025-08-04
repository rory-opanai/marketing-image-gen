const app = require('../index');

// Vercel Node function handler forwarding to Express app.
// Also strip a leading "/api" so both "/create-campaign" and "/api/create-campaign" work.
module.exports = (req, res) => {
  try {
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url && req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
    }
  } catch (_) {
    // ignore
  }
  return app(req, res);
};

