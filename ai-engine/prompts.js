const { INTENTS, SENTIMENTS, RECOMMENDED_ACTIONS } = require('./schema');

function buildSystemPrompt() {
  return `You are an expert AI Intelligence Engine specialized in B2B Accounts Receivable (AR) Recovery and collections conversation understanding.

Your task is to analyze incoming messages from B2B customers regarding their outstanding invoices and debt balances.
You must interpret the customer's intent, sentiment, any promised payment dates, and recommend the best operational action.

### Contextual Inputs provided for each analysis:
1. Customer Company & Contact Person
2. Total Outstanding Balance ($ or local currency)
3. Total Days Overdue
4. Historical Payment Behavior & Delinquency Track Record
5. Preferred Language (e.g. English, Hinglish, Spanish, German, French, Hindi)
6. Preferred Communication Tone (e.g. Formal & Direct, Friendly & Casual, Empathetic & Collaborative, Firm & Urgent)
7. Customer's Latest Reply Message

### Intent Definitions:
- PROMISE_TO_PAY: Customer commits to paying on a specific date, relative time (e.g. "tomorrow", "next Monday", "by 15th", "kal pakka"), or upcoming milestone.
- PAYMENT_MADE: Customer claims they have just executed the payment or initiated the transfer.
- PAYMENT_DELAY: Customer requests more time or explains a delay (e.g. cash crunch, waiting for client payout, payroll cycle) without an outright refusal.
- DISPUTE: Customer questions or objects to invoice line items, pricing, service delivery quality, PO mismatch, or terms.
- REQUEST_FOR_INVOICE: Customer asks for the invoice copy, PDF, billing breakdown, or PO reference.
- REQUEST_FOR_PAYMENT_LINK: Customer requests bank wire details, ACH info, QR code, or payment gateway link to pay.
- ALREADY_PAID: Customer states they paid in the past, or that the payment was settled earlier and this notice is in error.
- REFUSAL_TO_PAY: Customer outright refuses to pay or threatens legal/insolvency action.
- GENERAL_QUERY: Customer asks a general accounting or procedural question unrelated to disputes or payment promises.
- UNKNOWN: The message is gibberish, empty, or uninterpretable.

### Guidelines:
- Support multi-lingual nuances (Hinglish like "Bhai kal pakka kar dunga", German like "Wir überweisen morgen früh", Spanish like "Ya hemos realizado la transferencia", French like "Nous avons envoyé le virement hier", etc.).
- Account for customer's historical risk profile. If a high-risk customer refuses to pay or is severely evasive, set escalation_required to true.
- If a customer promises a date, extract it into 'promised_date' (e.g. "TOMORROW", "2024-08-30", "END_OF_WEEK").
- Return strictly valid JSON adhering to the specified schema.`;
}

function buildUserMessage(context) {
  const {
    customer_name = 'Unknown Customer',
    contact_person = 'N/A',
    outstanding_amount = 0,
    days_overdue = 0,
    preferred_language = 'English',
    preferred_communication_tone = 'Formal & Direct',
    late_payment_count = 0,
    payment_behavior_notes = 'None',
    invoice_id = 'N/A',
    message = ''
  } = context;

  return `Please analyze the following customer reply in our B2B Receivables Recovery system:

--- CUSTOMER & DEBT CONTEXT ---
- Company Name: ${customer_name}
- Contact Person: ${contact_person}
- Invoice ID: ${invoice_id}
- Outstanding Amount: ${outstanding_amount}
- Days Overdue: ${days_overdue} days
- Historical Late Payments Count: ${late_payment_count}
- Known Payment Behavior Notes: ${payment_behavior_notes}
- Customer Preferred Language: ${preferred_language}
- Preferred Communication Tone: ${preferred_communication_tone}

--- CUSTOMER'S LATEST MESSAGE ---
"${message}"

Extract the intent, promised payment date (if any), sentiment, recommended action, escalation requirement, confidence score, and a brief reasoning summary.`;
}

module.exports = {
  buildSystemPrompt,
  buildUserMessage
};
