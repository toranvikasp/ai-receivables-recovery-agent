const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(
  __dirname,
  "crm_database.sqlite"
);

const db = new sqlite3.Database(
  dbPath,
  (err) => {
    if (err) {
      console.error(
        "Error connecting to SQLite database:",
        err.message
      );
    } else {
      console.log(
        "Connected to SQLite database at:",
        dbPath
      );
    }
  }
);


// ============================================================
// DATABASE SETTINGS
// ============================================================

db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");


// ============================================================
// QUERY HELPERS
// ============================================================

function query(sql, params = []) {

  return new Promise(
    (resolve, reject) => {

      db.all(
        sql,
        params,
        (err, rows) => {

          if (err) {
            return reject(err);
          }

          resolve(rows);
        }
      );
    }
  );
}


function get(sql, params = []) {

  return new Promise(
    (resolve, reject) => {

      db.get(
        sql,
        params,
        (err, row) => {

          if (err) {
            return reject(err);
          }

          resolve(row);
        }
      );
    }
  );
}


function run(sql, params = []) {

  return new Promise(
    (resolve, reject) => {

      db.run(
        sql,
        params,
        function (err) {

          if (err) {
            return reject(err);
          }

          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      );
    }
  );
}


function exec(sql) {

  return new Promise(
    (resolve, reject) => {

      db.exec(
        sql,
        (err) => {

          if (err) {
            return reject(err);
          }

          resolve();
        }
      );
    }
  );
}


// ============================================================
// DATABASE SCHEMA
// ============================================================

async function initializeSchema() {

  const schema = `

    -- ========================================================
    -- CUSTOMERS
    -- ========================================================

    CREATE TABLE IF NOT EXISTS customers (

      id TEXT PRIMARY KEY,

      company_name TEXT NOT NULL,

      contact_person TEXT NOT NULL,

      email TEXT NOT NULL,

      phone TEXT NOT NULL,

      preferred_language TEXT NOT NULL
        DEFAULT 'English',

      preferred_communication_tone TEXT NOT NULL
        DEFAULT 'Formal & Direct',

      late_payment_count INTEGER NOT NULL
        DEFAULT 0,

      payment_behavior_notes TEXT,

      created_at TEXT NOT NULL
        DEFAULT (datetime('now'))
    );


    -- ========================================================
    -- INVOICES
    -- ========================================================

    CREATE TABLE IF NOT EXISTS invoices (

      id TEXT PRIMARY KEY,

      customer_id TEXT NOT NULL,

      invoice_amount REAL NOT NULL,

      amount_paid REAL NOT NULL
        DEFAULT 0,

      amount_outstanding REAL NOT NULL,

      issue_date TEXT NOT NULL,

      due_date TEXT NOT NULL,

      payment_status TEXT NOT NULL
        CHECK(
          payment_status IN (
            'PAID',
            'PENDING',
            'OVERDUE',
            'PARTIALLY_PAID'
          )
        ),

      description TEXT,

      created_at TEXT NOT NULL
        DEFAULT (datetime('now')),

      FOREIGN KEY (
        customer_id
      )
      REFERENCES customers(id)
      ON DELETE CASCADE
    );


    -- ========================================================
    -- PAYMENTS
    -- ========================================================

    CREATE TABLE IF NOT EXISTS payments (

      id TEXT PRIMARY KEY,

      invoice_id TEXT NOT NULL,

      customer_id TEXT NOT NULL,

      payment_amount REAL NOT NULL,

      payment_date TEXT NOT NULL,

      payment_status TEXT NOT NULL
        DEFAULT 'COMPLETED'

        CHECK(
          payment_status IN (
            'COMPLETED',
            'PENDING',
            'FAILED'
          )
        ),

      payment_method TEXT NOT NULL
        DEFAULT 'ACH Transfer',

      notes TEXT,

      created_at TEXT NOT NULL
        DEFAULT (datetime('now')),

      FOREIGN KEY (
        invoice_id
      )
      REFERENCES invoices(id)
      ON DELETE CASCADE,

      FOREIGN KEY (
        customer_id
      )
      REFERENCES customers(id)
      ON DELETE CASCADE
    );


    -- ========================================================
    -- AGENT AUDIT LOG
    -- ========================================================
    --
    -- Stores every important autonomous recovery event.
    --
    -- This gives us an enterprise-style history of:
    --
    -- AI analysis
    -- state changes
    -- decisions
    -- actions
    -- payment verification
    -- emails
    -- escalations
    -- case closure
    --
    -- ========================================================

    CREATE TABLE IF NOT EXISTS agent_audit_log (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      customer_id TEXT NOT NULL,

      invoice_id TEXT,

      event_type TEXT NOT NULL,

      previous_state TEXT,

      new_state TEXT,

      intent TEXT,

      action TEXT,

      priority TEXT,

      requires_human INTEGER NOT NULL
        DEFAULT 0,

      success INTEGER NOT NULL
        DEFAULT 1,

      reason TEXT,

      message TEXT,

      metadata TEXT,

      created_at TEXT NOT NULL
        DEFAULT (datetime('now')),

      FOREIGN KEY (
        customer_id
      )
      REFERENCES customers(id)
      ON DELETE CASCADE
    );


    -- ========================================================
    -- INDEXES
    -- ========================================================

    CREATE INDEX IF NOT EXISTS
      idx_invoices_cust
      ON invoices(customer_id);


    CREATE INDEX IF NOT EXISTS
      idx_invoices_status
      ON invoices(payment_status);


    CREATE INDEX IF NOT EXISTS
      idx_invoices_due
      ON invoices(due_date);


    CREATE INDEX IF NOT EXISTS
      idx_payments_inv
      ON payments(invoice_id);


    CREATE INDEX IF NOT EXISTS
      idx_payments_cust
      ON payments(customer_id);


    CREATE INDEX IF NOT EXISTS
      idx_audit_customer
      ON agent_audit_log(customer_id);


    CREATE INDEX IF NOT EXISTS
      idx_audit_event
      ON agent_audit_log(event_type);


    CREATE INDEX IF NOT EXISTS
      idx_audit_created
      ON agent_audit_log(created_at);

  `;


  await exec(schema);


  console.log(
    "[DATABASE] Schema initialized successfully."
  );
}


// ============================================================
// AUDIT LOG HELPER
// ============================================================

/**
 * Record an autonomous recovery event.
 *
 * This function is intentionally kept inside db.js so every
 * part of the agent can use the same database abstraction.
 */
async function recordAuditEvent({

  customerId,

  invoiceId = null,

  eventType,

  previousState = null,

  newState = null,

  intent = null,

  action = null,

  priority = "NORMAL",

  requiresHuman = false,

  success = true,

  reason = null,

  message = null,

  metadata = null

}) {

  const metadataJson =
    metadata == null
      ? null
      : JSON.stringify(metadata);


  return run(

    `INSERT INTO agent_audit_log (

      customer_id,

      invoice_id,

      event_type,

      previous_state,

      new_state,

      intent,

      action,

      priority,

      requires_human,

      success,

      reason,

      message,

      metadata

    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

    [

      customerId,

      invoiceId,

      eventType,

      previousState,

      newState,

      intent,

      action,

      priority,

      requiresHuman ? 1 : 0,

      success ? 1 : 0,

      reason,

      message,

      metadataJson

    ]
  );
}


// ============================================================
// GET AUDIT HISTORY
// ============================================================

async function getAuditHistory(
  customerId,
  limit = 100
) {

  return query(

    `SELECT

      id,

      customer_id,

      invoice_id,

      event_type,

      previous_state,

      new_state,

      intent,

      action,

      priority,

      requires_human,

      success,

      reason,

      message,

      metadata,

      created_at

     FROM agent_audit_log

     WHERE customer_id = ?

     ORDER BY id DESC

     LIMIT ?`,

    [
      customerId,
      limit
    ]
  );
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  db,

  query,

  get,

  run,

  exec,

  initializeSchema,

  recordAuditEvent,

  getAuditHistory

};