const {
    STATES,
    getState,
    updateState,
} = require("./state_manager");


/**
 * Generic state transition helper.
 */
function transitionTo(customerId, newState, updates = {}) {
    return updateState(customerId, {
        current_state: newState,
        ...updates,
    });
}


/**
 * Mark customer as contacted.
 */
function markContacted(customerId) {
    return transitionTo(
        customerId,
        STATES.CONTACTED,
        {
            next_action: "WAIT_FOR_CUSTOMER_RESPONSE",
        }
    );
}


/**
 * Record a customer promise to pay.
 */
function markPromiseMade(
    customerId,
    promisedDate = "TOMORROW"
) {
    return transitionTo(
        customerId,
        STATES.PROMISED_PAYMENT,
        {
            promised_date: promisedDate,
            last_intent: "PROMISE_TO_PAY",
            next_action: "WAITING_FOR_PAYMENT",
        }
    );
}


/**
 * Mark a payment follow-up as due.
 */
function markFollowUpDue(customerId) {
    return transitionTo(
        customerId,
        STATES.FOLLOW_UP_DUE,
        {
            next_action: "CONTACT_CUSTOMER",
        }
    );
}


/**
 * Escalate the recovery case to a human.
 */
function markEscalated(customerId) {
    return transitionTo(
        customerId,
        STATES.ESCALATED,
        {
            next_action: "ESCALATE_TO_RECOVERY_TEAM",
            escalated_to_human: true,
        }
    );
}


/**
 * Mark payment as officially received/verified.
 */
function markPaid(customerId) {
    return transitionTo(
        customerId,
        STATES.PAID,
        {
            promised_date: null,
            last_intent: "PAYMENT_RECEIVED",
            next_action: "CLOSE_CASE",
            escalated_to_human: false,
        }
    );
}


/**
 * Customer claims payment has been made.
 *
 * IMPORTANT:
 * This does NOT mean payment is confirmed.
 * The case moves to WAITING_FOR_PAYMENT and the
 * payment verification workflow takes over.
 */
function markPaymentClaimed(
    customerId,
    message = null
) {
    return transitionTo(
        customerId,
        STATES.WAITING_FOR_PAYMENT,
        {
            // The old promise is no longer relevant because
            // the customer now claims payment has been made.
            promised_date: null,

            last_message: message,

            last_intent: "PAYMENT_MADE",

            next_action: "VERIFY_PAYMENT_RECEIPT",

            escalated_to_human: false,
        }
    );
}


/**
 * Evaluate the current recovery state.
 *
 * Payment always has the highest priority.
 */
function evaluateState(
    customerId,
    paymentReceived = false
) {
    const state =
        getState(customerId);


    /*
     * ========================================================
     * PAYMENT RECEIVED
     * ========================================================
     *
     * Confirmed payment always wins over other states.
     */

    if (paymentReceived) {
        return markPaid(customerId);
    }


    /*
     * ========================================================
     * PROMISED PAYMENT
     * ========================================================
     *
     * Customer promised payment and the system is waiting.
     */

    if (
        state.current_state ===
        STATES.PROMISED_PAYMENT
    ) {
        return transitionTo(
            customerId,
            STATES.WAITING_FOR_PAYMENT,
            {
                next_action:
                    "WAIT_FOR_PROMISED_PAYMENT",
            }
        );
    }


    /*
     * ========================================================
     * FOLLOW-UP DUE
     * ========================================================
     *
     * Existing overdue follow-up requires human escalation.
     */

    if (
        state.current_state ===
        STATES.FOLLOW_UP_DUE
    ) {
        return markEscalated(
            customerId
        );
    }


    /*
     * ========================================================
     * NO TRANSITION REQUIRED
     * ========================================================
     */

    return state;
}


module.exports = {
    transitionTo,
    markContacted,
    markPromiseMade,
    markFollowUpDue,
    markEscalated,
    markPaid,
    markPaymentClaimed,
    evaluateState,
};