require('dotenv').config();
const { analyzeCustomerReply } = require('./ai-engine');
const { INTENTS, SENTIMENTS, RECOMMENDED_ACTIONS } = require('./ai-engine/schema');

const TEST_SCENARIOS = [
  {
    name: '1. Hinglish Promise to Pay (User Prompt Example)',
    context: {
      customer_name: 'Rahul Traders',
      contact_person: 'Rahul Sharma',
      outstanding_amount: 42000,
      days_overdue: 9,
      preferred_language: 'Hinglish',
      preferred_communication_tone: 'Friendly & Casual',
      late_payment_count: 2,
      payment_behavior_notes: 'Responds quickly on chat/calls.',
      message: 'Bhai kal pakka kar dunga.'
    },
    expectedIntent: 'PROMISE_TO_PAY',
    expectedDate: 'TOMORROW'
  },
  {
    name: '2. Spanish Payment Made Claim',
    context: {
      customer_name: 'Iberica Industrial Fabrics S.L.',
      contact_person: 'Carlos Mendes',
      outstanding_amount: 6200,
      days_overdue: 17,
      preferred_language: 'Spanish',
      preferred_communication_tone: 'Empathetic & Collaborative',
      late_payment_count: 3,
      message: 'Ya hemos realizado la transferencia esta mañana con el ref #998124.'
    },
    expectedIntent: 'PAYMENT_MADE'
  },
  {
    name: '3. English Invoice Line Item Dispute',
    context: {
      customer_name: 'Atlas Heavy Construction Ltd',
      contact_person: 'Bob Kowalski',
      outstanding_amount: 40000,
      days_overdue: 68,
      preferred_language: 'English',
      preferred_communication_tone: 'Formal & Direct',
      late_payment_count: 7,
      message: 'We dispute line item #3 for crane maintenance. Those hours were never logged or approved by our field engineer.'
    },
    expectedIntent: 'DISPUTE',
    expectedEscalation: true
  },
  {
    name: '4. English Request for Payment Link / ACH',
    context: {
      customer_name: 'Zenith Cloud Infrastructures',
      contact_person: 'Nathaniel Drake',
      outstanding_amount: 11200,
      days_overdue: 5,
      preferred_language: 'English',
      preferred_communication_tone: 'Concise & Data-Driven',
      late_payment_count: 1,
      message: 'Please share the ACH routing details and instant payment portal link so we can process today.'
    },
    expectedIntent: 'REQUEST_FOR_PAYMENT_LINK'
  },
  {
    name: '5. German Invoice Copy Request',
    context: {
      customer_name: 'Solaria Clean Energy Systems',
      contact_person: 'Dr. Elena Rostova',
      outstanding_amount: 28400,
      days_overdue: 12,
      preferred_language: 'German',
      preferred_communication_tone: 'Concise & Data-Driven',
      late_payment_count: 1,
      message: 'Können Sie uns bitte die Rechnungskopie mit der Leistungsaufstellung als PDF zusenden?'
    },
    expectedIntent: 'REQUEST_FOR_INVOICE'
  },
  {
    name: '6. English Refusal to Pay / Threat',
    context: {
      customer_name: 'Cascade Mountain Retail Group',
      contact_person: 'Timothy O Connor',
      outstanding_amount: 38900,
      days_overdue: 94,
      preferred_language: 'English',
      preferred_communication_tone: 'Firm & Urgent',
      late_payment_count: 9,
      message: 'We refuse to pay this invoice. Your software caused downtime and we are having our legal counsel handle this.'
    },
    expectedIntent: 'REFUSAL_TO_PAY',
    expectedEscalation: true
  },
  {
    name: '7. English Already Paid Notice',
    context: {
      customer_name: 'Apex Global Logistics Inc.',
      contact_person: 'Marcus Vance',
      outstanding_amount: 14500,
      days_overdue: 52,
      preferred_language: 'English',
      preferred_communication_tone: 'Formal & Direct',
      late_payment_count: 5,
      message: 'This invoice was already paid by ACH batch on the 28th. Please update your accounting records.'
    },
    expectedIntent: 'ALREADY_PAID'
  }
];

async function runAiTests() {
  console.log('🤖 Starting AI Intelligence Engine Test Suite...\n');
  let passed = 0;
  let failed = 0;

  for (const scenario of TEST_SCENARIOS) {
    try {
      const res = await analyzeCustomerReply(scenario.context);
      const data = res.data;

      // Validate schema properties
      if (!data.intent || !INTENTS.includes(data.intent)) {
        throw new Error(`Invalid intent: ${data.intent}`);
      }
      if (!data.sentiment || !SENTIMENTS.includes(data.sentiment)) {
        throw new Error(`Invalid sentiment: ${data.sentiment}`);
      }
      if (!data.recommended_action || !RECOMMENDED_ACTIONS.includes(data.recommended_action)) {
        throw new Error(`Invalid recommended_action: ${data.recommended_action}`);
      }
      if (typeof data.escalation_required !== 'boolean') {
        throw new Error(`escalation_required must be boolean, got ${typeof data.escalation_required}`);
      }
      if (typeof data.confidence !== 'number') {
        throw new Error(`confidence must be number, got ${typeof data.confidence}`);
      }
      if (!data.key_reasoning) {
        throw new Error(`Missing key_reasoning`);
      }

      console.log(`✅ [PASS] ${scenario.name}`);
      console.log(`   Source: ${res.source}`);
      console.log(`   Result: Intent=${data.intent} | Sentiment=${data.sentiment} | Action=${data.recommended_action} | Escalate=${data.escalation_required}`);
      console.log(`   Reasoning: "${data.key_reasoning}"\n`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${scenario.name}: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`🏁 AI Test Suite Finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runAiTests();
}

module.exports = { runAiTests };
