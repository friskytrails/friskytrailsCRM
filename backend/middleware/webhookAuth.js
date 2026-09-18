module.exports = function webhookAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const configuredSecret = process.env.LEAD_WEBHOOK_API_KEY || process.env.WEBHOOK_SECRET;

  if (!configuredSecret) {
    console.warn('WARNING: LEAD_WEBHOOK_API_KEY is not set in environment variables.');
    return res.status(500).json({
      error: 'Server configuration error: LEAD_WEBHOOK_API_KEY is not set in backend .env'
    });
  }

  if (!apiKey || apiKey !== configuredSecret) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing API key in x-api-key header'
    });
  }

  next();
};
