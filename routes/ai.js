const express = require('express');
const router = express.Router();
const { analyzeCustomerReply } = require('../ai-engine');
const config = require('../ai-engine/config');
const { get, query } = require('../db');

// GET /api/ai/health - Check AI engine health and configuration
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    module: 'B2B Receivables Recovery AI Intelligence Engine',
    model: config.model,
    has_api_key: config.hasApiKey,
    mode: config.hasApiKey ? 'gemini_live' : 'heuristic_fallback'
  });
});

// POST /api/ai/analyze-reply - Analyze customer message
router.post('/analyze-reply', async (req, res) => {
  try {
    const {
      customer_id,
      invoice_id,
      message,
      // Raw overrides if testing without CRM lookup
      customer_name,
      contact_person,
      outstanding_amount,
      days_overdue,
      preferred_language,
      preferred_communication_tone,
      late_payment_count,
      payment_behavior_notes
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "message"'
      });
    }

    let context = {
      message,
      customer_name: customer_name || 'Generic B2B Customer',
      contact_person: contact_person || 'Accounts Payable Lead',
      outstanding_amount: outstanding_amount !== undefined ? outstanding_amount : 10000,
      days_overdue: days_overdue !== undefined ? days_overdue : 15,
      preferred_language: preferred_language || 'English',
      preferred_communication_tone: preferred_communication_tone || 'Formal & Direct',
      late_payment_count: late_payment_count !== undefined ? late_payment_count : 2,
      payment_behavior_notes: payment_behavior_notes || 'Standard client profile.',
      invoice_id: invoice_id || 'N/A'
    };

    // If customer_id is provided, enrich context from database
    if (customer_id) {
      const cust = await get('SELECT * FROM customers WHERE id = ?', [customer_id]);
      if (cust) {
        context.customer_name = cust.company_name;
        context.contact_person = cust.contact_person;
        context.preferred_language = cust.preferred_language;
        context.preferred_communication_tone = cust.preferred_communication_tone;
        context.late_payment_count = cust.late_payment_count;
        context.payment_behavior_notes = cust.payment_behavior_notes;

        // Fetch overdue totals for customer
        const stat = await get(`
          SELECT 
            COALESCE(SUM(amount_outstanding), 0) as total_outstanding,
            COALESCE(MAX(CAST(julianday('now') - julianday(due_date) AS INTEGER)), 0) as max_overdue_days
          FROM invoices 
          WHERE customer_id = ? AND payment_status IN ('OVERDUE', 'PARTIALLY_PAID', 'PENDING')
        `, [customer_id]);

        if (stat) {
          if (stat.total_outstanding > 0) context.outstanding_amount = stat.total_outstanding;
          if (stat.max_overdue_days > 0) context.days_overdue = stat.max_overdue_days;
        }
      }
    }

    // If invoice_id is provided, enrich invoice details
    if (invoice_id && invoice_id !== 'N/A') {
      const inv = await get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
      if (inv) {
        context.invoice_id = inv.id;
        context.outstanding_amount = inv.amount_outstanding;
        const dueDays = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
        if (dueDays > 0) context.days_overdue = dueDays;
      }
    }

    const analysis = await analyzeCustomerReply(context);

    res.json({
      success: true,
      context_used: {
        customer_id: customer_id || null,
        invoice_id: context.invoice_id,
        customer_name: context.customer_name,
        contact_person: context.contact_person,
        outstanding_amount: context.outstanding_amount,
        days_overdue: context.days_overdue,
        preferred_language: context.preferred_language,
        preferred_communication_tone: context.preferred_communication_tone,
        late_payment_count: context.late_payment_count
      },
      ...analysis
    });
  } catch (error) {
    console.error('Error in /api/ai/analyze-reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
