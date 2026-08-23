require('dotenv').config();

const config = {
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null,
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  hasApiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
};

module.exports = config;
