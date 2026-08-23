// Heuristic / Rule-based Analyzer for offline test & demo mode when GEMINI_API_KEY is not configured

function analyzeFallback(context) {
  const msg = (context.message || '').trim().toLowerCase();
  const daysOverdue = parseInt(context.days_overdue || 0, 10);
  const lateCount = parseInt(context.late_payment_count || 0, 10);

  let intent = 'GENERAL_QUERY';
  let promised_date = 'NONE';
  let sentiment = 'NEUTRAL';
  let recommended_action = 'REPLY_TO_QUERY';
  let escalation_required = false;
  let confidence = 0.90;
  let key_reasoning = '';
  let suggested_reply_summary = '';

  // 1. PROMISE_TO_PAY
  if (
    msg.includes('kal pakka') ||
    msg.includes('tomorrow') ||
    msg.includes('by tomorrow') ||
    msg.includes('will pay by') ||
    msg.includes('next week') ||
    msg.includes('next monday') ||
    msg.includes('end of the week') ||
    msg.includes('uberweisen morgen') ||
    msg.includes('überweisen morgen') ||
    msg.includes('pagaremos mañana') ||
    msg.includes('je paierai demain') ||
    msg.includes('clear the payment by') ||
    msg.includes('promise to pay')
  ) {
    intent = 'PROMISE_TO_PAY';
    sentiment = 'COOPERATIVE';
    recommended_action = 'WAIT';
    if (msg.includes('kal') || msg.includes('tomorrow') || msg.includes('mañana') || msg.includes('morgen') || msg.includes('demain')) {
      promised_date = 'TOMORROW';
    } else if (msg.includes('next week') || msg.includes('next monday')) {
      promised_date = 'NEXT_WEEK';
    } else if (msg.includes('friday') || msg.includes('end of')) {
      promised_date = 'END_OF_WEEK';
    } else {
      promised_date = 'COMMITTED_DATE';
    }
    key_reasoning = `Customer committed to settle payment (${promised_date}). Language detected with cooperative sentiment.`;
    suggested_reply_summary = 'Thank the customer for their commitment and set a reminder for the promised date.';
  }
  // 2. PAYMENT_MADE / ALREADY_PAID
  else if (
    msg.includes('already paid') ||
    msg.includes('paid already') ||
    msg.includes('just transferred') ||
    msg.includes('sent the wire') ||
    msg.includes('payment done') ||
    msg.includes('kar diya') ||
    msg.includes('pay kar diya') ||
    msg.includes('ya pagamos') ||
    msg.includes('virement effectué') ||
    msg.includes('haben bezahlt') ||
    msg.includes('check #') ||
    msg.includes('ref #') ||
    msg.includes('reference number')
  ) {
    if (msg.includes('already paid') || msg.includes('paid last') || msg.includes('settled earlier')) {
      intent = 'ALREADY_PAID';
    } else {
      intent = 'PAYMENT_MADE';
    }
    sentiment = 'COOPERATIVE';
    recommended_action = 'VERIFY_PAYMENT_RECEIPT';
    key_reasoning = 'Customer indicates transaction has been initiated or previously completed. Bank receipt verification recommended.';
    suggested_reply_summary = 'Acknowledge notice, request transaction UTR/reference if missing, and verify with finance team.';
  }
  // 3. DISPUTE
  else if (
    msg.includes('dispute') ||
    msg.includes('wrong amount') ||
    msg.includes('incorrect') ||
    msg.includes('not delivered') ||
    msg.includes('not match') ||
    msg.includes('po discrepancy') ||
    msg.includes('never received') ||
    msg.includes('overcharged')
  ) {
    intent = 'DISPUTE';
    sentiment = 'FRUSTRATED';
    recommended_action = 'CLARIFY_DISPUTE';
    escalation_required = true;
    key_reasoning = 'Customer raised a dispute regarding billing accuracy or service fulfillment. Requires discrepancy resolution.';
    suggested_reply_summary = 'Apologize for inconvenience, request specific invoice line items in question, and loop in account manager.';
  }
  // 4. REQUEST_FOR_INVOICE
  else if (
    msg.includes('send invoice') ||
    msg.includes('invoice copy') ||
    msg.includes('resend the invoice') ||
    msg.includes('pdf copy') ||
    msg.includes('bill copy') ||
    msg.includes('facture') ||
    msg.includes('rechnung senden')
  ) {
    intent = 'REQUEST_FOR_INVOICE';
    sentiment = 'COOPERATIVE';
    recommended_action = 'SEND_INVOICE';
    key_reasoning = 'Customer requests duplicate or official invoice PDF copy to process billing.';
    suggested_reply_summary = 'Dispatch invoice PDF with attached PO and itemized breakdown.';
  }
  // 5. REQUEST_FOR_PAYMENT_LINK
  else if (
    msg.includes('payment link') ||
    msg.includes('bank details') ||
    msg.includes('how can i pay') ||
    msg.includes('qr code') ||
    msg.includes('wire instructions') ||
    msg.includes('ach info')
  ) {
    intent = 'REQUEST_FOR_PAYMENT_LINK';
    sentiment = 'COOPERATIVE';
    recommended_action = 'SEND_PAYMENT_LINK';
    key_reasoning = 'Customer is asking for remittance channel or instant payment portal link.';
    suggested_reply_summary = 'Provide direct secure payment URL and ACH/wire routing details.';
  }
  // 6. REFUSAL_TO_PAY
  else if (
    msg.includes('will not pay') ||
    msg.includes('wont pay') ||
    msg.includes('refuse') ||
    msg.includes('sue us') ||
    msg.includes('talk to my lawyer') ||
    msg.includes('legal counsel') ||
    msg.includes('bankrupt')
  ) {
    intent = 'REFUSAL_TO_PAY';
    sentiment = 'AGGRESSIVE';
    recommended_action = 'ESCALATE_TO_LEGAL';
    escalation_required = true;
    key_reasoning = 'Customer expressed explicit refusal to settle debt or initiated legal confrontation.';
    suggested_reply_summary = 'Notify legal & credit control team immediately. Cease automated conversational outreach.';
  }
  // 7. PAYMENT_DELAY
  else if (
    msg.includes('delay') ||
    msg.includes('cash flow') ||
    msg.includes('tight right now') ||
    msg.includes('waiting for our client') ||
    msg.includes('fund issue') ||
    msg.includes('problem with banking')
  ) {
    intent = 'PAYMENT_DELAY';
    sentiment = 'EVASIVE';
    recommended_action = daysOverdue > 30 || lateCount >= 5 ? 'ESCALATE_TO_MANAGER' : 'FOLLOW_UP_LATER';
    escalation_required = daysOverdue > 30 || lateCount >= 5;
    key_reasoning = 'Customer reports financial or operational delay without committing to fixed date.';
    suggested_reply_summary = 'Offer structured installment plan and ask for a firm commitment date.';
  }

  return {
    intent,
    promised_date,
    sentiment,
    recommended_action,
    escalation_required,
    confidence,
    key_reasoning: key_reasoning || 'Standard inquiry from customer analyzed via heuristic engine.',
    suggested_reply_summary: suggested_reply_summary || 'Respond politely to customer addressing their query.'
  };
}

module.exports = { analyzeFallback };
