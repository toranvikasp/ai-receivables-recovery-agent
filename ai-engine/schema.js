// Supported Intents in the B2B Receivables Recovery domain
const INTENTS = [
  'PROMISE_TO_PAY',
  'PAYMENT_MADE',
  'PAYMENT_DELAY',
  'DISPUTE',
  'REQUEST_FOR_INVOICE',
  'REQUEST_FOR_PAYMENT_LINK',
  'ALREADY_PAID',
  'REFUSAL_TO_PAY',
  'GENERAL_QUERY',
  'UNKNOWN'
];

// Supported Sentiments
const SENTIMENTS = [
  'COOPERATIVE',
  'EVASIVE',
  'FRUSTRATED',
  'AGGRESSIVE',
  'NEUTRAL'
];

// Supported Recommended Next Actions
const RECOMMENDED_ACTIONS = [
  'WAIT',
  'SEND_PAYMENT_LINK',
  'SEND_INVOICE',
  'VERIFY_PAYMENT_RECEIPT',
  'CLARIFY_DISPUTE',
  'ESCALATE_TO_MANAGER',
  'ESCALATE_TO_LEGAL',
  'FOLLOW_UP_LATER',
  'REPLY_TO_QUERY'
];

// JSON Schema definition for Google Gemini Structured Output
const RECOVERY_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: INTENTS,
      description: 'The classified customer intent based on their latest message.'
    },
    promised_date: {
      type: 'STRING',
      description: 'The promised payment date if mentioned (e.g. YYYY-MM-DD, "TOMORROW", "END_OF_WEEK", "NEXT_MONDAY"), or "NONE" / null if no promise made.'
    },
    sentiment: {
      type: 'STRING',
      enum: SENTIMENTS,
      description: 'The tone and sentiment detected in the customer message.'
    },
    recommended_action: {
      type: 'STRING',
      enum: RECOMMENDED_ACTIONS,
      description: 'The best operational next step for the receivables collection team/agent.'
    },
    escalation_required: {
      type: 'BOOLEAN',
      description: 'Whether immediate human or management intervention is required.'
    },
    confidence: {
      type: 'NUMBER',
      description: 'Confidence score of the intent classification from 0.0 to 1.0.'
    },
    key_reasoning: {
      type: 'STRING',
      description: 'Concise explanation for why this intent, sentiment, and action were determined.'
    },
    suggested_reply_summary: {
      type: 'STRING',
      description: 'Brief guideline of what the response to the customer should state, respecting their preferred language and tone.'
    }
  },
  required: [
    'intent',
    'sentiment',
    'recommended_action',
    'escalation_required',
    'confidence',
    'key_reasoning'
  ]
};

module.exports = {
  INTENTS,
  SENTIMENTS,
  RECOMMENDED_ACTIONS,
  RECOVERY_ANALYSIS_SCHEMA
};
