const express = require('express');
const router = express.Router();
const { query, get } = require('../db');

// GET /api/payments - List all payment receipts
router.get('/', async (req, res) => {
  try {
    const { customer_id, invoice_id, limit = 100 } = req.query;
    let sql = `
      SELECT 
        p.*,
        c.company_name,
        c.contact_person,
        i.invoice_amount,
        i.description as invoice_description
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      JOIN invoices i ON p.invoice_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      sql += ` AND p.customer_id = ?`;
      params.push(customer_id);
    }
    if (invoice_id) {
      sql += ` AND p.invoice_id = ?`;
      params.push(invoice_id);
    }

    sql += ` ORDER BY p.payment_date DESC, p.created_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const payments = await query(sql, params);
    res.json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/payments/:id - Single payment record
router.get('/:id', async (req, res) => {
  try {
    const payment = await get(`
      SELECT 
        p.*,
        c.company_name,
        c.contact_person,
        c.email as customer_email,
        i.invoice_amount,
        i.amount_outstanding,
        i.description as invoice_description
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      JOIN invoices i ON p.invoice_id = i.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
