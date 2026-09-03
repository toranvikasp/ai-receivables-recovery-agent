require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const {
  initializeSchema,
  get
} = require('./db');

const {
  seedDatabase
} = require('./seed');

// Gmail automatic recovery processor
const {
  processUnreadGmail
} = require('./integrations/gmail/gmail_processor');

// Automatic promise/payment checker
const {
  checkAllPromises
} = require('./agent/promise_checker');


const app = express();

const PORT =
  process.env.PORT || 3000;


/*
 * ============================================================
 * MIDDLEWARE
 * ============================================================
 */

app.use(
  cors({
    origin: '*',

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With'
    ]
  })
);


app.use(
  express.json()
);


app.use(
  express.urlencoded({
    extended: true
  })
);


app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);


/*
 * ============================================================
 * REQUEST LOGGER
 * ============================================================
 */

app.use(
  (req, res, next) => {

    const start =
      Date.now();


    res.on(
      'finish',
      () => {

        const duration =
          Date.now() - start;


        if (
          !req.url.startsWith(
            '/styles.css'
          ) &&
          !req.url.startsWith(
            '/app.js'
          )
        ) {

          console.log(
            `[${new Date().toISOString()}] ` +
            `${req.method} ${req.originalUrl} ` +
            `${res.statusCode} - ${duration}ms`
          );
        }
      }
    );


    next();
  }
);


/*
 * ============================================================
 * EXISTING CRM & AR ROUTES
 * ============================================================
 */

app.use(
  '/api/dashboard',
  require('./routes/dashboard')
);


app.use(
  '/api/customers',
  require('./routes/customers')
);


app.use(
  '/api/invoices',
  require('./routes/invoices')
);


app.use(
  '/api/payments',
  require('./routes/payments')
);


/*
 * ============================================================
 * AI & GMAIL ROUTES
 * ============================================================
 */

app.use(
  '/api/ai',
  require('./routes/ai')
);


app.use(
  '/api/gmail',
  require('./routes/gmail')
);


/*
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 */

app.get(
  '/api/health',
  (req, res) => {

    res.json({

      status:
        'healthy',

      timestamp:
        new Date().toISOString(),

      service:
        'B2B Mock Accounts Receivable & CRM System',

      version:
        '1.0.0'
    });
  }
);


/*
 * ============================================================
 * DATABASE SEED
 * ============================================================
 */

app.post(
  '/api/seed',
  async (req, res) => {

    try {

      await seedDatabase();


      res.json({

        success:
          true,

        message:
          'Database reset and seeded with 32+ customers and 65 invoices!'
      });

    } catch (error) {

      res.status(500).json({

        success:
          false,

        error:
          error.message
      });
    }
  }
);


/*
 * ============================================================
 * FRONTEND FALLBACK
 * ============================================================
 */

app.get(
  '*',
  (req, res) => {

    if (
      req.accepts('html')
    ) {

      res.sendFile(
        path.join(
          __dirname,
          'public',
          'index.html'
        )
      );

    } else {

      res.status(404).json({

        error:
          'Endpoint not found'
      });
    }
  }
);


/*
 * ============================================================
 * BACKGROUND GMAIL CHECKER
 * ============================================================
 */

async function runGmailChecker() {

  console.log(
    '[GMAIL AUTO] Checking Gmail for new emails...'
  );


  try {

    const result =
      await processUnreadGmail(10);


    if (
      result.processed > 0
    ) {

      console.log(
        `[GMAIL AUTO] Processed ${result.processed} customer email(s).`
      );

    } else {

      console.log(
        '[GMAIL AUTO] No new customer emails.'
      );
    }


  } catch (error) {

    console.error(
      '[GMAIL AUTO] Processing error:',
      error.message
    );
  }
}


/*
 * ============================================================
 * BACKGROUND PROMISE CHECKER
 * ============================================================
 */

async function runPromiseChecker() {

  console.log(
    '[PROMISE AUTO] Checking promised payments...'
  );


  try {

    const result =
      await checkAllPromises();


    if (
      result.changed > 0
    ) {

      console.log(
        `[PROMISE AUTO] ${result.changed} customer state(s) updated.`
      );


      for (
        const change of result.results
      ) {

        console.log(
          `[PROMISE AUTO] ${change.customer_id}: ` +
          `${change.previous_state} → ` +
          `${change.current_state}`
        );


        console.log(
          `[PROMISE AUTO] Next action: ${change.next_action}`
        );
      }

    } else {

      console.log(
        `[PROMISE AUTO] Checked ${result.checked} customer(s). No state changes.`
      );
    }


  } catch (error) {

    console.error(
      '[PROMISE AUTO] Checker error:',
      error.message
    );
  }
}


/*
 * ============================================================
 * START SERVER
 * ============================================================
 */

async function start() {

  try {

    /*
     * ========================================================
     * DATABASE INITIALIZATION
     * ========================================================
     */

    await initializeSchema();


    const countRow =
      await get(
        'SELECT COUNT(*) as count FROM customers'
      );


    if (
      !countRow ||
      countRow.count === 0
    ) {

      console.log(
        'Database is empty. Automatically seeding demo dataset...'
      );


      await seedDatabase();

    } else {

      console.log(
        `Database already contains ${countRow.count} customers. Ready!`
      );
    }


    /*
     * ========================================================
     * START EXPRESS SERVER
     * ========================================================
     */

    app.listen(
      PORT,
      async () => {

        console.log(
          '==================================================='
        );


        console.log(
          '🚀 Mock CRM & Accounts Receivable ERP is LIVE!'
        );


        console.log(
          `📍 Web Dashboard:  http://localhost:${PORT}`
        );


        console.log(
          `🔌 REST API Base:   http://localhost:${PORT}/api`
        );


        console.log(
          `🤖 AI Engine API:  http://localhost:${PORT}/api/ai/analyze-reply`
        );


        console.log(
          `📖 API Docs UI:    http://localhost:${PORT}#api-docs`
        );


        console.log(
          '==================================================='
        );


        /*
         * ====================================================
         * GMAIL AUTOMATION
         * ====================================================
         */

        console.log(
          '[GMAIL AUTO] Starting background Gmail checker...'
        );


        /*
         * Run Gmail checker immediately.
         */

        await runGmailChecker();


        /*
         * Run Gmail checker every 60 seconds.
         */

        setInterval(
          runGmailChecker,
          60 * 1000
        );


        console.log(
          '[GMAIL AUTO] Background checker active — checking every 60 seconds.'
        );


        /*
         * ====================================================
         * PROMISE AUTOMATION
         * ====================================================
         */

        console.log(
          '[PROMISE AUTO] Starting automatic promise checker...'
        );


        /*
         * Run promise checker immediately.
         */

        await runPromiseChecker();


        /*
         * Run promise checker every 60 seconds.
         */

        setInterval(
          runPromiseChecker,
          60 * 1000
        );


        console.log(
          '[PROMISE AUTO] Background checker active — checking every 60 seconds.'
        );


        /*
         * ====================================================
         * AUTOMATION STATUS
         * ====================================================
         */

        console.log(
          '==================================================='
        );

        console.log(
          '🤖 AI RECOVERY AUTOMATION ACTIVE'
        );

        console.log(
          '📧 Gmail monitoring: ACTIVE'
        );

        console.log(
          '💰 Payment verification: ACTIVE'
        );

        console.log(
          '⏰ Promise monitoring: ACTIVE'
        );

        console.log(
          '🔄 Follow-up detection: ACTIVE'
        );

        console.log(
          '==================================================='
        );
      }
    );


  } catch (error) {

    console.error(
      'Failed to start server:',
      error
    );


    process.exit(1);
  }
}


/*
 * ============================================================
 * START APPLICATION
 * ============================================================
 */

start();