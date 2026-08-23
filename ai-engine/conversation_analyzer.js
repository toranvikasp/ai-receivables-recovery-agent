const config = require('./config');
const { RECOVERY_ANALYSIS_SCHEMA } = require('./schema');
const { buildSystemPrompt, buildUserMessage } = require('./prompts');
const { analyzeFallback } = require('./fallback_analyzer');

let genAiClient = null;

function getClient() {
  if (!genAiClient && config.hasApiKey) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      genAiClient = new GoogleGenAI({ apiKey: config.apiKey });
    } catch (err) {
      console.warn('[AI Engine] Failed to initialize @google/genai:', err.message);
    }
  }
  return genAiClient;
}

/**
 * Analyzes a customer reply within the B2B receivables context.
 *
 * @param {Object} context
 * @returns {Promise<Object>}
 */
async function analyzeCustomerReply(context) {
  if (!context || !context.message) {
    throw new Error('context.message is required for AI analysis');
  }

  const client = getClient();

  // If Gemini API Key is available, use live Gemini API with structured schema output
  if (client && config.hasApiKey) {
    try {
      const systemInstruction = buildSystemPrompt();
      const userPrompt = buildUserMessage(context);

      const response = await client.models.generateContent({
        model: config.model,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: RECOVERY_ANALYSIS_SCHEMA,
          temperature: 0.1
        }
      });

      const text = response.text;
      const parsed = JSON.parse(text);

      return {
        success: true,
        source: 'gemini_api',
        model: config.model,
        data: parsed
      };
    } catch (err) {
      console.error('[AI Engine: Gemini API Error, falling back]:', err.message);
      const fallbackResult = analyzeFallback(context);
      return {
        success: true,
        source: 'fallback_engine_on_error',
        error_note: err.message,
        data: fallbackResult
      };
    }
  }

  // Fallback engine when GEMINI_API_KEY is not supplied in environment
  const result = analyzeFallback(context);
  return {
    success: true,
    source: 'heuristic_engine_no_api_key',
    note: 'GEMINI_API_KEY not set in environment. Operating in heuristic test mode.',
    data: result
  };
}

module.exports = {
  analyzeCustomerReply
};
