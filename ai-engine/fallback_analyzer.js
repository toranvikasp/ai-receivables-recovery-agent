// Heuristic / Rule-based Analyzer for offline test & demo mode
// when GEMINI_API_KEY is not configured

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
  let suggested_response = '';

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

    if (
      msg.includes('kal') ||
      msg.includes('tomorrow') ||
      msg.includes('mañana') ||
      msg.includes('morgen') ||
      msg.includes('demain')
    ) {
      promised_date = 'TOMORROW';
    } else if (
      msg.includes('next week') ||
      msg.includes('next monday')
    ) {
      promised_date = 'NEXT_WEEK';
    } else if (
      msg.includes('friday') ||
      msg.includes('end of')
    ) {
      promised_date = 'END_OF_WEEK';
    } else {
      promised_date = 'COMMITTED_DATE';
    }

    key_reasoning =
      `Customer committed to settle payment (${promised_date}). Language detected with cooperative sentiment.`;

    suggested_reply_summary =
      'Thank the customer for their commitment and confirm the promised payment date.';

    suggested_response =
      promised_date === 'TOMORROW'
        ? 'Thank you for confirming your payment commitment. We appreciate your prompt attention and will monitor the payment expected tomorrow.'
        : `Thank you for confirming your payment commitment. We will monitor the payment for the promised date (${promised_date}).`;
  }

  // 2. PAYMENT_RECEIVED / PAYMENT_MADE / ALREADY_PAID
  else if (
    msg.includes('payment has been received') ||
    msg.includes('received the payment') ||
    msg.includes('credited to our account') ||
    msg.includes('payment was received') ||
    msg.includes('already paid') ||
    msg.includes('paid already') ||
    msg.includes('just transferred') ||
    msg.includes('sent the wire') ||
    msg.includes('sent the payment') ||
    msg.includes('payment released') ||
    msg.includes('payment has been initiated') ||
    msg.includes('payment done') ||
    msg.includes('kar diya') ||
    msg.includes('pay kar diya') ||
    msg.includes('ya pagamos') ||
    msg.includes('virement effectué') ||
    msg.includes('haben bezahlt') ||
    msg.includes('check #') ||
    msg.includes('ref #') ||
    msg.includes('reference number') ||
    msg.includes('wire #') ||
    msg.includes('transaction reference')
  ) {
    // PAYMENT_RECEIVED
    if (
      msg.includes('payment has been received') ||
      msg.includes('received the payment') ||
      msg.includes('credited to our account') ||
      msg.includes('payment was received')
    ) {
      intent = 'PAYMENT_RECEIVED';
      recommended_action = 'WAIT';

      key_reasoning =
        'Explicit statement that payment has been received and credited to the account.';

      suggested_reply_summary =
        'Thank the customer and confirm that the received payment will be reflected in the account.';

      suggested_response =
        'Thank you for the payment update. We acknowledge receipt and will update the account records accordingly.';
    }

    // ALREADY_PAID
    else if (
      msg.includes('already paid') ||
      msg.includes('paid last') ||
      msg.includes('settled earlier')
    ) {
      intent = 'ALREADY_PAID';
      recommended_action = 'VERIFY_PAYMENT_RECEIPT';

      key_reasoning =
        'Customer states payment was made previously.';

      suggested_reply_summary =
        'Acknowledge the claim and verify the previous payment against the account.';

      suggested_response =
        'Thank you for the update. We will verify the previous payment against our records and update the account once confirmed.';
    }

    // PAYMENT_MADE
    else {
      intent = 'PAYMENT_MADE';
      recommended_action = 'VERIFY_PAYMENT_RECEIPT';

      key_reasoning =
        'Customer indicates a payment transfer has been initiated or sent. Verification of receipt is recommended.';

      suggested_reply_summary =
        'Acknowledge the payment initiation, reference the transaction if available, and verify receipt.';

      // Extract transaction/reference information when available.
      const referenceMatch =
        context.message.match(
          /(?:transaction\s+reference|reference(?:\s+number)?|ref|wire|check)\s*(?:is|#|number)?\s*([A-Z0-9-]+)/i
        );

      const reference = referenceMatch
        ? referenceMatch[1]
        : null;

      if (reference) {
        suggested_response =
          `Thank you for the payment confirmation. We will verify transaction reference ${reference} and update your account once the payment is confirmed.`;
      } else {
        suggested_response =
          'Thank you for the payment update. We will verify the transaction and update your account once the payment is confirmed.';
      }
    }

    sentiment = 'COOPERATIVE';
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

    key_reasoning =
      'Customer raised a dispute regarding billing accuracy or service fulfillment. Requires discrepancy resolution.';

    suggested_reply_summary =
      'Acknowledge the dispute and indicate that the invoice/account details will be reviewed.';

    suggested_response =
      'Thank you for bringing this to our attention. We will review the invoice and account details and coordinate with the appropriate team to resolve the discrepancy.';
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

    key_reasoning =
      'Customer requests duplicate or official invoice PDF copy to process billing.';

    suggested_reply_summary =
      'Confirm that the requested invoice copy and billing details can be provided.';

    suggested_response =
      'Certainly. We will provide the requested invoice copy and billing details for your records.';
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

    key_reasoning =
      'Customer is asking for remittance channel or payment instructions.';

    suggested_reply_summary =
      'Provide secure payment instructions or the appropriate payment link.';

    suggested_response =
      'Certainly. We can provide the appropriate payment instructions and secure payment link to help you complete the transfer.';
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

    key_reasoning =
      'Customer expressed explicit refusal to settle debt or initiated legal confrontation.';

    suggested_reply_summary =
      'Remain professional and indicate that the matter will be reviewed by the appropriate team.';

    suggested_response =
      'We understand your position. We will refer the matter to the appropriate team for review and follow up through the proper channel.';
  }

  // 7. PAYMENT_DELAY
  else if (
    msg.includes('cannot pay') ||
    msg.includes("can't pay") ||
    msg.includes('cannot make the payment') ||
    msg.includes("can't make the payment") ||
    msg.includes('need more time') ||
    msg.includes('need another') ||
    msg.includes('give me more time') ||
    msg.includes('30 days') ||
    msg.includes('another 30 days') ||
    msg.includes('delay') ||
    msg.includes('cash flow') ||
    msg.includes('tight right now') ||
    msg.includes('waiting for our client') ||
    msg.includes('fund issue') ||
    msg.includes('problem with banking')
  ) {
    intent = 'PAYMENT_DELAY';
    sentiment = 'EVASIVE';

    recommended_action =
      daysOverdue > 30 || lateCount >= 5
        ? 'ESCALATE_TO_MANAGER'
        : 'FOLLOW_UP_LATER';

    escalation_required =
      daysOverdue > 30 || lateCount >= 5;

    key_reasoning =
      'Customer reports financial or operational delay without committing to a fixed payment date.';

    suggested_reply_summary =
      'Acknowledge the delay and request a realistic payment commitment date.';

    suggested_response =
      'Thank you for the update. We understand the situation. Please provide a realistic payment date so we can update our recovery plan accordingly.';
  }

  // 8. GENERAL QUERY / UNKNOWN
  else {
    intent = 'GENERAL_QUERY';
    sentiment = 'NEUTRAL';
    recommended_action = 'REPLY_TO_QUERY';

    key_reasoning =
      'Standard inquiry from customer analyzed via heuristic engine.';

    suggested_reply_summary =
      'Respond politely to the customer and address their request clearly.';

    suggested_response =
      'Thank you for your message. We will review your request and provide the appropriate information.';
  }

  return {
    intent,
    promised_date,
    sentiment,
    recommended_action,
    escalation_required,
    confidence,
    key_reasoning:
      key_reasoning ||
      'Standard inquiry from customer analyzed via heuristic engine.',
    suggested_reply_summary:
      suggested_reply_summary ||
      'Respond politely to customer addressing their query.',
    suggested_response:
      suggested_response ||
      'Thank you for your message. We will review your request and respond accordingly.'
  };
}

module.exports = { analyzeFallback };