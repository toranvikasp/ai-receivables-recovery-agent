const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');

// GET /api/invoices/overdue - Overdue invoices with days overdue & customer details
router.get('/overdue', async (req, res) => {
  try {
    const sql = `
      SELECT 
        i.*,
        c.company_name,
        c.contact_person,
        c.email as customer_email,
        c.phone as customer_phone,
        c.preferred_language,
        c.preferred_communication_tone,
        c.late_payment_count,
        c.payment_behavior_notes,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.payment_status = 'OVERDUE' OR (i.payment_status = 'PARTIALLY_PAID' AND i.due_date < date('now'))
      ORDER BY days_overdue DESC, i.amount_outstanding DESC
    `;

    const overdueInvoices = await query(sql);
    res.json({
      success: true,
      count: overdueInvoices.length,
      total_overdue_amount: overdueInvoices.reduce((sum, inv) => sum + inv.amount_outstanding, 0),
      data: overdueInvoices
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/invoices - List all invoices with filters & sorting
router.get('/', async (req, res) => {
  try {
    const { status, customer_id, sort = 'due_date', order = 'ASC', search } = req.query;

    let sql = `
      SELECT 
        i.*,
        c.company_name,
        c.contact_person,
        c.email as customer_email,
        c.preferred_language,
        c.preferred_communication_tone,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND i.payment_status = ?`;
      params.push(status.toUpperCase());
    }

    if (customer_id) {
      sql += ` AND i.customer_id = ?`;
      params.push(customer_id);
    }

    if (search) {
      sql += ` AND (i.id LIKE ? OR c.company_name LIKE ? OR i.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const allowedSorts = {
      'amount': 'i.invoice_amount',
      'outstanding': 'i.amount_outstanding',
      'due_date': 'i.due_date',
      'issue_date': 'i.issue_date',
      'company': 'c.company_name',
      'status': 'i.payment_status'
    };
    const sortCol = allowedSorts[sort] || 'i.due_date';
    const sortDir = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    sql += ` ORDER BY ${sortCol} ${sortDir}`;

    const invoices = await query(sql, params);
    res.json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/invoices/:id - Single invoice details with payment history
router.get('/:id', async (req, res) => {
  try {
    const invoice = await get(`
      SELECT 
        i.*,
        c.company_name,
        c.contact_person,
        c.email as customer_email,
        c.phone as customer_phone,
        c.preferred_language,
        c.preferred_communication_tone,
        c.late_payment_count,
        c.payment_behavior_notes,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const payments = await query(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...invoice,
        payments
      }
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', async (req, res) => {
  try {
    const {
      customer_id,
      invoice_amount,
      issue_date = new Date().toISOString().split('T')[0],
      due_date,
      description = ''
    } = req.body;

    if (!customer_id || !invoice_amount || !due_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customer_id, invoice_amount, due_date'
      });
    }

    const customer = await get('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer does not exist' });
    }

    const lastInv = await get('SELECT id FROM invoices WHERE id LIKE "INV-%" ORDER BY id DESC LIMIT 1');
    let nextNum = 66;
    if (lastInv && lastInv.id) {
      const match = lastInv.id.match(/\d+$/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const id = req.body.id || `INV-2024-${String(nextNum).padStart(3, '0')}`;

    const amount = parseFloat(invoice_amount);
    const today = new Date().toISOString().split('T')[0];
    let payment_status = 'PENDING';
    if (due_date < today) {
      payment_status = 'OVERDUE';
    }

    await run(`
      INSERT INTO invoices (id, customer_id, invoice_amount, amount_paid, amount_outstanding, issue_date, due_date, payment_status, description)
      VALUES (?, ?, ?, 0.00, ?, ?, ?, ?, ?)
    `, [id, customer_id, amount, amount, issue_date, due_date, payment_status, description]);

    const newInvoice = await get('SELECT * FROM invoices WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: newInvoice });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/invoices/:id - Update invoice
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const {
      payment_status = existing.payment_status,
      due_date = existing.due_date,
      description = existing.description,
      amount_paid = existing.amount_paid
    } = req.body;

    const paid = parseFloat(amount_paid);
    const outstanding = Math.max(0, existing.invoice_amount - paid);

    let calculatedStatus = payment_status;
    if (paid >= existing.invoice_amount) {
      calculatedStatus = 'PAID';
    } else if (paid > 0 && paid < existing.invoice_amount) {
      calculatedStatus = 'PARTIALLY_PAID';
    }

    await run(`
      UPDATE invoices 
      SET payment_status = ?, due_date = ?, description = ?, amount_paid = ?, amount_outstanding = ?
      WHERE id = ?
    `, [calculatedStatus, due_date, description, paid, outstanding, id]);

    const updated = await get('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/invoices/:id/payments - Record a payment against an invoice
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await get(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    const {
      payment_amount,
      payment_date = new Date().toISOString().split('T')[0],
      payment_method = 'ACH Transfer',
      notes = ''
    } = req.body;

    const amount = parseFloat(payment_amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'payment_amount must be greater than 0'
      });
    }

    /*
     * ============================================================
     * PAYMENT ID
     * ============================================================
     *
     * A caller can provide payment_id so the same payment event
     * can be safely retried without creating a duplicate ledger
     * entry.
     */

    const lastPay = await get(
      'SELECT id FROM payments WHERE id LIKE "PAY-%" ORDER BY id DESC LIMIT 1'
    );

    let nextNum = 1027;

    if (lastPay && lastPay.id) {
      const match = lastPay.id.match(/\d+/);

      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }

    const payId =
      req.body.payment_id || `PAY-${nextNum}`;


    /*
     * ============================================================
     * IDEMPOTENCY PROTECTION
     * ============================================================
     *
     * The payment ID is treated as the unique identifier for the
     * payment event.
     *
     * If the same payment_id arrives again, DO NOT insert another
     * payment and DO NOT modify the invoice balance again.
     */

    const existingPayment = await get(
      'SELECT * FROM payments WHERE id = ?',
      [payId]
    );

    if (existingPayment) {

      const currentInvoice = await get(
        'SELECT * FROM invoices WHERE id = ?',
        [id]
      );

      console.log(
        `[IDEMPOTENCY] Duplicate payment ignored: ${payId}`
      );

      return res.status(200).json({
        success: true,
        already_processed: true,
        duplicate: true,
        message:
          'Payment already processed. Duplicate event ignored.',
        payment: existingPayment,
        invoice: currentInvoice
      });
    }


    /*
     * ============================================================
     * CREATE PAYMENT
     * ============================================================
     */

    await run(`
      INSERT INTO payments (
        id,
        invoice_id,
        customer_id,
        payment_amount,
        payment_date,
        payment_status,
        payment_method,
        notes
      )
      VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
    `, [
      payId,
      id,
      invoice.customer_id,
      amount,
      payment_date,
      payment_method,
      notes
    ]);


    /*
     * ============================================================
     * UPDATE INVOICE
     * ============================================================
     */

    const newPaid =
      invoice.amount_paid + amount;

    const newOutstanding =
      Math.max(
        0,
        invoice.invoice_amount - newPaid
      );

    let newStatus = 'PAID';

    if (newOutstanding > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    await run(`
      UPDATE invoices
      SET
        amount_paid = ?,
        amount_outstanding = ?,
        payment_status = ?
      WHERE id = ?
    `, [
      newPaid,
      newOutstanding,
      newStatus,
      id
    ]);


    /*
     * ============================================================
     * RETURN UPDATED RECORDS
     * ============================================================
     */

    const updatedInvoice = await get(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );

    const createdPayment = await get(
      'SELECT * FROM payments WHERE id = ?',
      [payId]
    );


    res.status(201).json({
      success: true,
      already_processed: false,
      duplicate: false,
      message: 'Payment recorded successfully',
      payment: createdPayment,
      invoice: updatedInvoice
    });

  } catch (error) {

    console.error(
      'Error recording payment:',
      error
    );

    /*
     * SQLite UNIQUE constraint protection.
     *
     * This is an additional safety net in case two identical
     * payment requests arrive at nearly the same time.
     */

    if (
      error.message &&
      error.message.includes('UNIQUE constraint failed')
    ) {

      const payId = req.body.payment_id;

      const existingPayment = payId
        ? await get(
          'SELECT * FROM payments WHERE id = ?',
          [payId]
        )
        : null;

      const currentInvoice = await get(
        'SELECT * FROM invoices WHERE id = ?',
        [req.params.id]
      );

      return res.status(200).json({
        success: true,
        already_processed: true,
        duplicate: true,
        message:
          'Payment already processed. Duplicate event ignored.',
        payment: existingPayment,
        invoice: currentInvoice
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
