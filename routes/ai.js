const express = require('express');
const router = express.Router();

const { analyzeCustomerReply } = require('../ai-engine');
const config = require('../ai-engine/config');

const {
  get,
  query,
  recordAuditEvent
} = require('../db');

// ============================================================
// AGENT MODULES
// ============================================================

const {
  processCustomerMessage
} = require('../agent/recovery_agent');

const {
  getState,
  updateState,
  STATES
} = require('../agent/state_manager');

const {
  markContacted,
  markPromiseMade,
  markFollowUpDue,
  markEscalated,
  markPaid
} = require('../agent/state_transition_engine');


// ============================================================
// GET /api/ai/health
// ============================================================

router.get('/health', (req, res) => {

  res.json({

    status: 'healthy',

    module:
      'B2B Receivables Recovery AI Intelligence Engine',

    model:
      config.model,

    has_api_key:
      config.hasApiKey,

    mode:
      config.hasApiKey
        ? 'gemini_live'
        : 'heuristic_fallback'

  });

});


// ============================================================
// POST /api/ai/analyze-reply
// ============================================================

router.post('/analyze-reply', async (req, res) => {

  try {

    const {
      customer_id,
      invoice_id,
      message,
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

        error:
          'Missing required field: "message"'

      });

    }


    let context = {

      message,

      customer_name:
        customer_name ||
        'Generic B2B Customer',

      contact_person:
        contact_person ||
        'Accounts Payable Lead',

      outstanding_amount:
        outstanding_amount !== undefined
          ? outstanding_amount
          : 10000,

      days_overdue:
        days_overdue !== undefined
          ? days_overdue
          : 15,

      preferred_language:
        preferred_language ||
        'English',

      preferred_communication_tone:
        preferred_communication_tone ||
        'Formal & Direct',

      late_payment_count:
        late_payment_count !== undefined
          ? late_payment_count
          : 2,

      payment_behavior_notes:
        payment_behavior_notes ||
        'Standard client profile.',

      invoice_id:
        invoice_id ||
        'N/A'

    };


    // ========================================================
    // ENRICH CUSTOMER FROM DATABASE
    // ========================================================

    if (customer_id) {

      const cust = await get(
        'SELECT * FROM customers WHERE id = ?',
        [customer_id]
      );


      if (cust) {

        context.customer_name =
          cust.company_name;

        context.contact_person =
          cust.contact_person;

        context.preferred_language =
          cust.preferred_language;

        context.preferred_communication_tone =
          cust.preferred_communication_tone;

        context.late_payment_count =
          cust.late_payment_count;

        context.payment_behavior_notes =
          cust.payment_behavior_notes;


        const stat = await get(
          `
            SELECT

              COALESCE(
                SUM(amount_outstanding),
                0
              ) AS total_outstanding,

              COALESCE(
                MAX(
                  CAST(
                    julianday('now')
                    - julianday(due_date)
                    AS INTEGER
                  )
                ),
                0
              ) AS max_overdue_days

            FROM invoices

            WHERE customer_id = ?

              AND payment_status IN (
                'OVERDUE',
                'PARTIALLY_PAID',
                'PENDING'
              )
          `,
          [customer_id]
        );


        if (stat) {

          if (stat.total_outstanding > 0) {

            context.outstanding_amount =
              stat.total_outstanding;

          }


          if (stat.max_overdue_days > 0) {

            context.days_overdue =
              stat.max_overdue_days;

          }

        }

      }

    }


    // ========================================================
    // ENRICH INVOICE
    // ========================================================

    if (
      invoice_id &&
      invoice_id !== 'N/A'
    ) {

      const inv = await get(
        'SELECT * FROM invoices WHERE id = ?',
        [invoice_id]
      );


      if (inv) {

        context.invoice_id =
          inv.id;

        context.outstanding_amount =
          inv.amount_outstanding;


        const dueDays =
          Math.floor(
            (
              Date.now()
              -
              new Date(
                inv.due_date
              ).getTime()
            )
            /
            (1000 * 60 * 60 * 24)
          );


        if (dueDays > 0) {

          context.days_overdue =
            dueDays;

        }

      }

    }


    const analysis =
      await analyzeCustomerReply(
        context
      );


    res.json({

      success: true,

      context_used: {

        customer_id:
          customer_id || null,

        invoice_id:
          context.invoice_id,

        customer_name:
          context.customer_name,

        contact_person:
          context.contact_person,

        outstanding_amount:
          context.outstanding_amount,

        days_overdue:
          context.days_overdue,

        preferred_language:
          context.preferred_language,

        preferred_communication_tone:
          context.preferred_communication_tone,

        late_payment_count:
          context.late_payment_count

      },

      ...analysis

    });

  }

  catch (error) {

    console.error(
      'Error in /api/ai/analyze-reply:',
      error
    );


    res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

});


// ============================================================
// LIVE ACTIVITY STREAM
// ============================================================

const activityLog = [

  {
    id: 'act-1',

    timestamp:
      new Date(
        Date.now() -
        5 * 60 * 1000
      ).toISOString(),

    time_display:
      new Date(
        Date.now() -
        5 * 60 * 1000
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),

    type:
      'MESSAGE_ANALYZED',

    customer_id:
      'CUST-1001',

    company_name:
      'Apex Global Logistics Inc.',

    title:
      'AI analyzed customer reply',

    details:
      'Intent: PROMISE_TO_PAY | Sentiment: Cooperative | Confidence: 95%',

    state:
      'PROMISED_PAYMENT',

    amount:
      18200
  },

  {
    id: 'act-2',

    timestamp:
      new Date(
        Date.now() -
        12 * 60 * 1000
      ).toISOString(),

    time_display:
      new Date(
        Date.now() -
        12 * 60 * 1000
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),

    type:
      'AGENT_DECISION',

    customer_id:
      'CUST-1001',

    company_name:
      'Apex Global Logistics Inc.',

    title:
      'Agent decision: WAIT_FOR_PAYMENT',

    details:
      'Promise date recorded: Tomorrow. Automation waiting for check.',

    state:
      'WAITING_FOR_PAYMENT',

    amount:
      18200
  },

  {
    id: 'act-3',

    timestamp:
      new Date(
        Date.now() -
        25 * 60 * 1000
      ).toISOString(),

    time_display:
      new Date(
        Date.now() -
        25 * 60 * 1000
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),

    type:
      'FOLLOW_UP_TRIGGERED',

    customer_id:
      'CUST-1004',

    company_name:
      'Meridian Industrial Systems',

    title:
      'Promised payment missed by expected date',

    details:
      'State updated to FOLLOW_UP_DUE. Automated reminder queued.',

    state:
      'FOLLOW_UP_DUE',

    amount:
      42500
  },

  {
    id: 'act-4',

    timestamp:
      new Date(
        Date.now() -
        40 * 60 * 1000
      ).toISOString(),

    time_display:
      new Date(
        Date.now() -
        40 * 60 * 1000
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),

    type:
      'ESCALATION_TRIGGERED',

    customer_id:
      'CUST-1008',

    company_name:
      'Great Lakes Foundry',

    title:
      'Case escalated to human recovery team',

    details:
      '830 days overdue. Unresponsive to automated follow-ups.',

    state:
      'ESCALATED',

    amount:
      85000
  },

  {
    id: 'act-5',

    timestamp:
      new Date(
        Date.now() -
        55 * 60 * 1000
      ).toISOString(),

    time_display:
      new Date(
        Date.now() -
        55 * 60 * 1000
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),

    type:
      'PAYMENT_RECEIVED',

    customer_id:
      'CUST-1012',

    company_name:
      'Horizon Tech Solutions',

    title:
      'Payment received: $25,000.00',

    details:
      'Case automatically transitioned to PAID state and closed.',

    state:
      'PAID',

    amount:
      25000
  }

];


function recordActivity(event) {

  const now =
    new Date();


  activityLog.unshift({

    id:
      'act-' +
      Date.now(),

    timestamp:
      now.toISOString(),

    time_display:
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),

    ...event

  });


  if (
    activityLog.length >
    50
  ) {

    activityLog.pop();

  }

}


// ============================================================
// GET /api/ai/cases
// ============================================================

router.get('/cases', async (req, res) => {

  try {

    const customers =
      await query(
        `
          SELECT

            c.*,

            COUNT(DISTINCT i.id)
              AS invoice_count,

            COALESCE(
              SUM(
                i.amount_outstanding
              ),
              0
            ) AS total_outstanding,

            COALESCE(
              SUM(
                CASE
                  WHEN
                    i.payment_status =
                    'OVERDUE'
                  THEN
                    i.amount_outstanding
                  ELSE
                    0
                END
              ),
              0
            ) AS overdue_amount,

            COALESCE(
              MAX(
                CAST(
                  julianday('now')
                  -
                  julianday(i.due_date)
                  AS INTEGER
                )
              ),
              0
            ) AS max_days_overdue

          FROM customers c

          LEFT JOIN invoices i
            ON c.id = i.customer_id

          GROUP BY c.id

          ORDER BY
            overdue_amount DESC,
            c.company_name ASC
        `
      );


    const cases =
      customers.map(
        cust => {

          let agentState =
            getState(
              cust.id
            );


          // ==================================================
          // INITIAL STATE
          // ==================================================

          if (
            !agentState.last_intent &&
            !agentState.last_message
          ) {

            if (
              cust.overdue_amount > 50000 &&
              cust.late_payment_count >= 5
            ) {

              agentState =
                updateState(
                  cust.id,
                  {
                    current_state:
                      STATES.ESCALATED,

                    next_action:
                      'ESCALATE_TO_RECOVERY_TEAM'
                  }
                );

            }

            else if (
              cust.overdue_amount > 0 &&
              cust.late_payment_count >= 3
            ) {

              agentState =
                updateState(
                  cust.id,
                  {
                    current_state:
                      STATES.FOLLOW_UP_DUE,

                    next_action:
                      'SEND_FOLLOW_UP'
                  }
                );

            }

            else if (
              cust.overdue_amount > 0
            ) {

              agentState =
                updateState(
                  cust.id,
                  {
                    current_state:
                      STATES.OVERDUE,

                    next_action:
                      'CONTACT_CUSTOMER'
                  }
                );

            }

            else if (
              cust.total_outstanding === 0 &&
              cust.invoice_count > 0
            ) {

              agentState =
                updateState(
                  cust.id,
                  {
                    current_state:
                      STATES.PAID,

                    next_action:
                      'CLOSE_CASE'
                  }
                );

            }

          }


          return {

            customer_id:
              cust.id,

            company_name:
              cust.company_name,

            contact_person:
              cust.contact_person,

            email:
              cust.email,

            phone:
              cust.phone,

            preferred_language:
              cust.preferred_language,

            preferred_communication_tone:
              cust.preferred_communication_tone,

            late_payment_count:
              cust.late_payment_count,

            total_outstanding:
              cust.total_outstanding,

            overdue_amount:
              cust.overdue_amount,

            max_days_overdue:
              cust.max_days_overdue,

            invoice_count:
              cust.invoice_count,


            current_state:
              agentState.current_state,

            next_action:
              agentState.next_action,

            promised_date:
              agentState.promised_date,


            last_message:
              agentState.last_message,

            last_intent:
              agentState.last_intent,


            last_execution:
              agentState.last_execution,

            last_outbound_message:
              agentState.last_outbound_message,

            updated_at:
              agentState.updated_at

          };

        }
      );


    const pipeline = {

      OVERDUE:
        { count: 0, amount: 0 },

      CONTACTED:
        { count: 0, amount: 0 },

      PROMISED_PAYMENT:
        { count: 0, amount: 0 },

      WAITING_FOR_PAYMENT:
        { count: 0, amount: 0 },

      FOLLOW_UP_DUE:
        { count: 0, amount: 0 },

      ESCALATED:
        { count: 0, amount: 0 },

      PAID:
        { count: 0, amount: 0 },

      CLOSED:
        { count: 0, amount: 0 }

    };


    let activeAgentsCount = 0;

    let promisesTrackedCount = 0;

    let followUpsDueCount = 0;

    let escalationsCount = 0;


    cases.forEach(c => {

      const st =
        c.current_state ||
        'OVERDUE';


      if (
        pipeline[st]
      ) {

        pipeline[st].count += 1;

        pipeline[st].amount +=
          c.total_outstanding;

      }


      if (
        st !== 'PAID' &&
        st !== 'CLOSED'
      ) {

        activeAgentsCount++;

      }


      if (
        st === 'PROMISED_PAYMENT' ||
        st === 'WAITING_FOR_PAYMENT'
      ) {

        promisesTrackedCount++;

      }


      if (
        st === 'FOLLOW_UP_DUE'
      ) {

        followUpsDueCount++;

      }


      if (
        st === 'ESCALATED'
      ) {

        escalationsCount++;

      }

    });


    res.json({

      success: true,

      ops_summary: {

        active_agents:
          activeAgentsCount,

        promises_tracked:
          promisesTrackedCount,

        follow_ups_due:
          followUpsDueCount,

        escalations:
          escalationsCount

      },

      pipeline,

      cases

    });

  }

  catch (error) {

    console.error(
      'Error fetching AI recovery cases:',
      error
    );


    res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

});


// ============================================================
// POST /api/ai/process-message
// ============================================================

router.post(
  '/process-message',
  async (req, res) => {

    try {

      const {
        customer_id,
        message
      } = req.body;


      if (
        !customer_id ||
        !message
      ) {

        return res.status(400).json({

          success: false,

          error:
            'Missing customer_id or message'

        });

      }


      const cust =
        await get(
          'SELECT * FROM customers WHERE id = ?',
          [customer_id]
        );


      if (!cust) {

        return res.status(404).json({

          success: false,

          error:
            'Customer not found'

        });

      }


      const stat =
        await get(
          `
            SELECT

              COALESCE(
                SUM(amount_outstanding),
                0
              ) AS total_outstanding,

              COALESCE(
                MAX(
                  CAST(
                    julianday('now')
                    -
                    julianday(due_date)
                    AS INTEGER
                  )
                ),
                0
              ) AS max_overdue_days

            FROM invoices

            WHERE customer_id = ?

              AND payment_status IN (
                'OVERDUE',
                'PARTIALLY_PAID',
                'PENDING'
              )
          `,
          [customer_id]
        );


      const context = {

        customer_id:
          cust.id,

        message,

        customer_name:
          cust.company_name,

        contact_person:
          cust.contact_person,

        outstanding_amount:
          stat
            ? stat.total_outstanding
            : 10000,

        days_overdue:
          stat
            ? stat.max_overdue_days
            : 15,

        preferred_language:
          cust.preferred_language,

        preferred_communication_tone:
          cust.preferred_communication_tone,

        late_payment_count:
          cust.late_payment_count,

        payment_behavior_notes:
          cust.payment_behavior_notes

      };


      const result =
        await processCustomerMessage(
          context
        );


      recordActivity({

        type:
          'MESSAGE_ANALYZED',

        customer_id:
          cust.id,

        company_name:
          cust.company_name,

        title:
          `AI analyzed message from ${cust.company_name}`,

        details:
          `Intent: ${result.analysis.intent} | Sentiment: ${result.analysis.sentiment_analysis?.tone || 'Cooperative'}`,

        state:
          result.state.current_state,

        amount:
          context.outstanding_amount

      });


      recordActivity({

        type:
          'AGENT_DECISION',

        customer_id:
          cust.id,

        company_name:
          cust.company_name,

        title:
          `AI Action: ${result.decision.action}`,

        details:
          result.decision.reason,

        state:
          result.state.current_state,

        amount:
          context.outstanding_amount

      });


      res.json({

        success:
          true,

        data:
          result

      });

    }

    catch (error) {

      console.error(
        'Error processing customer message:',
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// ============================================================
// POST /api/ai/state-transition
// ============================================================

router.post(
  '/state-transition',
  async (req, res) => {

    try {

      const {
        customer_id,
        action,
        date
      } = req.body;


      if (
        !customer_id ||
        !action
      ) {

        return res.status(400).json({

          success: false,

          error:
            'Missing customer_id or action'

        });

      }


      const cust =
        await get(
          'SELECT company_name FROM customers WHERE id = ?',
          [customer_id]
        );


      const companyName =
        cust
          ? cust.company_name
          : customer_id;


      let newState;


      switch (
      action.toUpperCase()
      ) {

        case 'MARK_CONTACTED':
        case 'CONTACTED':

          newState =
            markContacted(
              customer_id
            );

          break;


        case 'MARK_PROMISED':
        case 'PROMISED':

          newState =
            markPromiseMade(
              customer_id,
              date ||
              'TOMORROW'
            );

          break;


        case 'SEND_FOLLOW_UP':
        case 'FOLLOW_UP_DUE':

          newState =
            markFollowUpDue(
              customer_id
            );

          break;


        case 'ESCALATE':
        case 'ESCALATED':

          newState =
            markEscalated(
              customer_id
            );

          break;


        case 'MARK_PAID':
        case 'PAID':

          newState =
            markPaid(
              customer_id
            );

          break;


        default:

          return res.status(400).json({

            success: false,

            error:
              'Unknown transition action: ' +
              action

          });

      }


      recordActivity({

        type:
          'STATE_TRANSITION',

        customer_id,

        company_name:
          companyName,

        title:
          `State updated to ${newState.current_state}`,

        details:
          `Action executed: ${action} | Next action: ${newState.next_action}`,

        state:
          newState.current_state

      });
      await recordAuditEvent({

  customerId:
    customer_id,

  eventType:
    'STATE_TRANSITION',

  newState:
    newState.current_state,

  action:
    action.toUpperCase(),

  priority:
    newState.current_state === 'ESCALATED'
      ? 'HIGH'
      : 'NORMAL',

  requiresHuman:
    newState.current_state === 'ESCALATED',

  success:
    true,

  reason:
    `Recovery state transition executed: ${action.toUpperCase()}`,

  message:
    `Case transitioned to ${newState.current_state}.`,

  metadata: {

    next_action:
      newState.next_action,

    source:
      'MANUAL_RECOVERY_ACTION'

  }

});


      res.json({

        success:
          true,

        data:
          newState

      });

    }

    catch (error) {

      console.error(
        'Error executing state transition:',
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// ============================================================
// GET /api/ai/activity
// ============================================================

router.get(
  '/activity',
  (req, res) => {

    res.json({

      success:
        true,

      count:
        activityLog.length,

      data:
        activityLog

    });

  }
);


// ============================================================
// NEW: GET /api/ai/audit
//
// REAL SQLite audit history
// ============================================================

router.get(
  '/audit',
  async (req, res) => {

    try {

      let limit =
        parseInt(
          req.query.limit,
          10
        );


      if (
        !Number.isFinite(limit)
      ) {

        limit = 50;

      }


      limit =
        Math.min(
          Math.max(
            limit,
            1
          ),
          200
        );


      const events =
        await query(
          `
            SELECT

              id,

              customer_id,

              invoice_id,

              event_type,

              intent,

              action,

              previous_state,

              new_state,

              priority,

              requires_human,

              success,

              reason,

              message,

              metadata,

              created_at

            FROM agent_audit_log

            ORDER BY id DESC

            LIMIT ?
          `,
          [limit]
        );


      res.json({

        success:
          true,

        count:
          events.length,

        data:
          events

      });

    }

    catch (error) {

      console.error(
        'Error fetching audit log:',
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// ============================================================
// NEW: GET /api/ai/audit/:customerId
//
// REAL CUSTOMER RECOVERY TIMELINE
// ============================================================

router.get(
  '/audit/:customerId',
  async (req, res) => {

    try {

      const customerId =
        req.params.customerId;


      const customer =
        await get(
          `
            SELECT

              id,

              company_name,

              contact_person,

              email

            FROM customers

            WHERE id = ?
          `,
          [customerId]
        );


      if (!customer) {

        return res.status(404).json({

          success:
            false,

          error:
            'Customer not found'

        });

      }


      const events =
        await query(
          `
            SELECT

              id,

              customer_id,

              invoice_id,

              event_type,

              intent,

              action,

              previous_state,

              new_state,

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
          `,
          [customerId]
        );


      res.json({

        success:
          true,

        customer,

        count:
          events.length,

        data:
          events

      });

    }

    catch (error) {

      console.error(
        'Error fetching customer audit history:',
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// ============================================================
// POST /api/ai/gmail/send-reply
// ============================================================

router.post(
  '/gmail/send-reply',
  async (req, res) => {

    try {

      const {
        customer_id,
        to,
        subject,
        body,
        thread_id
      } = req.body;


      if (
        !customer_id ||
        !to ||
        !body
      ) {

        return res.status(400).json({

          success: false,

          error:
            'Missing customer_id, to, or body'

        });

      }


      const customer =
        await get(
          'SELECT * FROM customers WHERE id = ?',
          [customer_id]
        );


      if (!customer) {

        return res.status(404).json({

          success: false,

          error:
            'Customer not found'

        });

      }


      const {
        sendEmail
      } =
        require(
          '../integrations/gmail/gmail_service'
        );


      const result =
        await sendEmail({

          to,

          subject:
            subject ||
            `Re: Payment Update - ${customer.company_name}`,

          body

        });


      updateState(
        customer_id,
        {

          last_outbound_message:
            body,

          last_execution:
            'Recovery reply sent through Gmail.'

        }
      );


      recordActivity({

        type:
          'GMAIL_REPLY_SENT',

        customer_id,

        company_name:
          customer.company_name,

        title:
          'Recovery reply sent through Gmail',

        details:
          `Email sent to ${to}`,

        state:
          getState(
            customer_id
          ).current_state

      });


      res.json({

        success:
          true,

        message:
          'Recovery reply sent through Gmail.',

        gmail:
          result,

        customer_id

      });

    }

    catch (error) {

      console.error(
        'Error sending Gmail recovery reply:',
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message

      });

    }

  }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;