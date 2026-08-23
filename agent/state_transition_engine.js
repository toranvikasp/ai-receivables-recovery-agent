const {
    STATES,
    getState,
    updateState,
} = require("./state_manager");


function transitionTo(customerId, newState, updates = {}) {
    return updateState(customerId, {
        current_state: newState,
        ...updates,
    });
}


function markContacted(customerId) {
    return transitionTo(
        customerId,
        STATES.CONTACTED,
        {
            next_action: "WAIT_FOR_CUSTOMER_RESPONSE",
        }
    );
}


function markPromiseMade(customerId, promisedDate = "TOMORROW") {
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


function markFollowUpDue(customerId) {
    return transitionTo(
        customerId,
        STATES.FOLLOW_UP_DUE,
        {
            next_action: "CONTACT_CUSTOMER",
        }
    );
}


function markEscalated(customerId) {
    return transitionTo(
        customerId,
        STATES.ESCALATED,
        {
            next_action: "ESCALATE_TO_RECOVERY_TEAM",
        }
    );
}


function markPaid(customerId) {
    return transitionTo(
        customerId,
        STATES.PAID,
        {
            promised_date: null,
            last_intent: "PAYMENT_RECEIVED",
            next_action: "CLOSE_CASE",
        }
    );
}


function evaluateState(customerId, paymentReceived = false) {
    const state = getState(customerId);

    // Payment always wins.
    if (paymentReceived) {
        return markPaid(customerId);
    }

    // A promised payment is currently waiting.
    if (state.current_state === STATES.PROMISED_PAYMENT) {
        return transitionTo(
            customerId,
            STATES.WAITING_FOR_PAYMENT,
            {
                next_action: "WAIT_FOR_PROMISED_PAYMENT",
            }
        );
    }

    // If follow-up is already due, escalate.
    if (state.current_state === STATES.FOLLOW_UP_DUE) {
        return markEscalated(customerId);
    }

    return state;
}


module.exports = {
    transitionTo,
    markContacted,
    markPromiseMade,
    markFollowUpDue,
    markEscalated,
    markPaid,
    evaluateState,
};