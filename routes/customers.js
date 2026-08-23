const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');

// GET /api/customers - List all customers with aggregate AR stats & filters
router.get('/', async (req, res) => {
  try {
    const { search, tone, language, risk } = req.query;
    let sql = `
      SELECT 
        c.*,
        COUNT(DISTINCT i.id) as total_invoices_count,
        COALESCE(SUM(CASE WHEN i.payment_status = 'OVERDUE' THEN 1 ELSE 0 END), 0) as overdue_invoices_count,
        COALESCE(SUM(i.invoice_amount), 0) as total_invoiced_amount,
        COALESCE(SUM(i.amount_paid), 0) as total_paid_amount,
        COALESCE(SUM(i.amount_outstanding), 0) as total_outstanding_amount,
        COALESCE(SUM(CASE WHEN i.payment_status = 'OVERDUE' THEN i.amount_outstanding ELSE 0 END), 0) as total_overdue_amount
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (c.company_name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ? OR c.id LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (tone) {
      sql += ` AND c.preferred_communication_tone = ?`;
      params.push(tone);
    }

    if (language) {
      sql += ` AND c.preferred_language = ?`;
      params.push(language);
    }

    if (risk === 'high') {
      sql += ` AND c.late_payment_count >= 5`;
    } else if (risk === 'medium') {
      sql += ` AND c.late_payment_count BETWEEN 2 AND 4`;
    } else if (risk === 'low') {
      sql += ` AND c.late_payment_count <= 1`;
    }

    sql += ` GROUP BY c.id ORDER BY total_overdue_amount DESC, c.company_name ASC`;

    const customers = await query(sql, params);
    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:id - Single customer with AR metrics & behavior profile
router.get('/:id', async (req, res) => {
  try {
    const customer = await get(`
      SELECT 
        c.*,
        COUNT(DISTINCT i.id) as total_invoices_count,
        COALESCE(SUM(CASE WHEN i.payment_status = 'OVERDUE' THEN 1 ELSE 0 END), 0) as overdue_invoices_count,
        COALESCE(SUM(i.invoice_amount), 0) as total_invoiced_amount,
        COALESCE(SUM(i.amount_paid), 0) as total_paid_amount,
        COALESCE(SUM(i.amount_outstanding), 0) as total_outstanding_amount,
        COALESCE(SUM(CASE WHEN i.payment_status = 'OVERDUE' THEN i.amount_outstanding ELSE 0 END), 0) as total_overdue_amount
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [req.params.id]);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const invoices = await query(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY due_date DESC
    `, [req.params.id]);

    const payments = await query(`
      SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...customer,
        invoices,
        payments
      }
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:id/invoices - Customer invoices
router.get('/:id/invoices', async (req, res) => {
  try {
    const customer = await get('SELECT id, company_name FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const invoices = await query(`
      SELECT * FROM invoices WHERE customer_id = ? ORDER BY due_date ASC
    `, [req.params.id]);

    res.json({
      success: true,
      customer_id: req.params.id,
      company_name: customer.company_name,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:id/payments - Customer payment history
router.get('/:id/payments', async (req, res) => {
  try {
    const customer = await get('SELECT id, company_name FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const payments = await query(`
      SELECT p.*, i.description as invoice_description, i.invoice_amount 
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE p.customer_id = ? 
      ORDER BY p.payment_date DESC
    `, [req.params.id]);

    res.json({
      success: true,
      customer_id: req.params.id,
      company_name: customer.company_name,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching customer payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/customers - Create new customer
router.post('/', async (req, res) => {
  try {
    const {
      company_name,
      contact_person,
      email,
      phone,
      preferred_language = 'English',
      preferred_communication_tone = 'Formal & Direct',
      payment_behavior_notes = '',
      late_payment_count = 0
    } = req.body;

    if (!company_name || !contact_person || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: company_name, contact_person, email, phone'
      });
    }

    const lastCust = await get('SELECT id FROM customers WHERE id LIKE "CUST-%" ORDER BY id DESC LIMIT 1');
    let nextNum = 1033;
    if (lastCust && lastCust.id) {
      const match = lastCust.id.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const id = req.body.id || `CUST-${nextNum}`;

    await run(`
      INSERT INTO customers (id, company_name, contact_person, email, phone, preferred_language, preferred_communication_tone, late_payment_count, payment_behavior_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_name, contact_person, email, phone, preferred_language, preferred_communication_tone, late_payment_count, payment_behavior_notes]);

    const newCustomer = await get('SELECT * FROM customers WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: newCustomer });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/customers/:id - Update customer preferences & details
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const {
      company_name = existing.company_name,
      contact_person = existing.contact_person,
      email = existing.email,
      phone = existing.phone,
      preferred_language = existing.preferred_language,
      preferred_communication_tone = existing.preferred_communication_tone,
      late_payment_count = existing.late_payment_count,
      payment_behavior_notes = existing.payment_behavior_notes
    } = req.body;

    await run(`
      UPDATE customers 
      SET company_name = ?, contact_person = ?, email = ?, phone = ?, 
          preferred_language = ?, preferred_communication_tone = ?,
          late_payment_count = ?, payment_behavior_notes = ?
      WHERE id = ?
    `, [company_name, contact_person, email, phone, preferred_language, preferred_communication_tone, late_payment_count, payment_behavior_notes, id]);

    const updated = await get('SELECT * FROM customers WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
