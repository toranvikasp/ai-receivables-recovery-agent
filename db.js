const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'crm_database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Enable WAL mode & foreign keys for concurrency & data integrity
db.run('PRAGMA journal_mode = WAL;');
db.run('PRAGMA foreign_keys = ON;');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function initializeSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      preferred_language TEXT NOT NULL DEFAULT 'English',
      preferred_communication_tone TEXT NOT NULL DEFAULT 'Formal & Direct',
      late_payment_count INTEGER NOT NULL DEFAULT 0,
      payment_behavior_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      invoice_amount REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      amount_outstanding REAL NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      payment_status TEXT NOT NULL CHECK(payment_status IN ('PAID', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID')),
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(payment_status IN ('COMPLETED', 'PENDING', 'FAILED')),
      payment_method TEXT NOT NULL DEFAULT 'ACH Transfer',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_cust ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
    CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);
    CREATE INDEX IF NOT EXISTS idx_payments_inv ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_cust ON payments(customer_id);
  `;

  await exec(schema);
}

module.exports = {
  db,
  query,
  get,
  run,
  exec,
  initializeSchema
};
