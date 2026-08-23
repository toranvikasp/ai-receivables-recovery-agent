const express = require('express');
const router = express.Router();
const { query, get } = require('../db');

// GET /api/dashboard/stats - Global AR summary KPIs
router.get('/stats', async (req, res) => {
  try {
    const stats = await get(`
      SELECT 
        COUNT(id) as total_invoices,
        COALESCE(SUM(invoice_amount), 0) as total_invoiced,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(amount_outstanding), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN payment_status = 'OVERDUE' THEN amount_outstanding ELSE 0 END), 0) as total_overdue,
        COALESCE(SUM(CASE WHEN payment_status = 'OVERDUE' THEN 1 ELSE 0 END), 0) as overdue_invoices_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending_invoices_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PARTIALLY_PAID' THEN 1 ELSE 0 END), 0) as partially_paid_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END), 0) as paid_invoices_count
      FROM invoices
    `);

    const customerStats = await get(`
      SELECT 
        COUNT(id) as total_customers,
        COALESCE(SUM(CASE WHEN late_payment_count >= 5 THEN 1 ELSE 0 END), 0) as high_risk_customers_count
      FROM customers
    `);

    const aging = await query(`
      SELECT 
        CASE 
          WHEN (julianday('now') - julianday(due_date)) <= 30 THEN '1-30 Days'
          WHEN (julianday('now') - julianday(due_date)) <= 60 THEN '31-60 Days'
          WHEN (julianday('now') - julianday(due_date)) <= 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END as aging_bucket,
        COUNT(id) as invoice_count,
        SUM(amount_outstanding) as bucket_amount
      FROM invoices
      WHERE payment_status = 'OVERDUE'
      GROUP BY aging_bucket
    `);

    const topOverdue = await query(`
      SELECT 
        i.*,
        c.company_name,
        c.contact_person,
        c.preferred_communication_tone,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.payment_status = 'OVERDUE'
      ORDER BY days_overdue DESC, i.amount_outstanding DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        total_outstanding: stats.total_outstanding,
        total_overdue: stats.total_overdue,
        total_paid: stats.total_paid,
        total_invoiced: stats.total_invoiced,
        overdue_invoices_count: stats.overdue_invoices_count,
        pending_invoices_count: stats.pending_invoices_count,
        paid_invoices_count: stats.paid_invoices_count,
        total_customers: customerStats.total_customers,
        high_risk_customers_count: customerStats.high_risk_customers_count,
        aging_breakdown: aging,
        top_overdue_invoices: topOverdue
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
