const {
    STATES,
    getState,
} = require("./state_manager");

const {
    markFollowUpDue,
    markPaid,
} = require("./state_transition_engine");

function isPromiseDue(promisedDate) {
    if (!promisedDate) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // For our first version, TOMORROW becomes due
    // when the current date reaches/passes that promise date.
    if (promisedDate === "TOMORROW") {
        return false;
    }

    const promiseDate = new Date(promisedDate);
    promiseDate.setHours(0, 0, 0, 0);

    return today >= promiseDate;
}


function checkPromise(customerId, paymentReceived = false) {
    const state = getState(customerId);

    // Payment received always closes the recovery case.
    if (paymentReceived) {
        return markPaid(
            customerId,
            "Payment received."
        );
    }

    // Only check customers who promised payment.
    if (
        state.current_state !== STATES.PROMISED_PAYMENT &&
        state.current_state !== STATES.WAITING_FOR_PAYMENT
    ) {
        return state;
    }

    // If the promised date has arrived, follow up.
    if (isPromiseDue(state.promised_date)) {
        return markFollowUpDue(customerId);
    }

    return state;
}


module.exports = {
    isPromiseDue,
    checkPromise,
};