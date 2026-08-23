const { STATES } = require("./state_manager");

function decideNextAction(state) {
    switch (state.current_state) {
        case STATES.OVERDUE:
            return {
                action: "CONTACT_CUSTOMER",
                reason: "Invoice is overdue and customer has not been contacted.",
            };

        case STATES.CONTACTED:
            return {
                action: "WAIT_FOR_CUSTOMER_RESPONSE",
                reason: "Customer has been contacted.",
            };

        case STATES.PROMISED_PAYMENT:
            return {
                action: "WAIT_FOR_PAYMENT",
                reason: `Customer promised payment for ${state.promised_date}.`,
            };

        case STATES.WAITING_FOR_PAYMENT:
            return {
                action: "CHECK_PAYMENT_STATUS",
                reason: "Customer has promised payment and the system should verify payment.",
            };

        case STATES.FOLLOW_UP_DUE:
            return {
                action: "SEND_FOLLOW_UP",
                reason: "Promised payment has not arrived by the expected date.",
            };

        case STATES.ESCALATED:
            return {
                action: "ESCALATE_TO_RECOVERY_TEAM",
                reason: "Customer requires human intervention.",
            };

        case STATES.PAID:
            return {
                action: "CLOSE_CASE",
                reason: "Payment has been received.",
            };

        case STATES.CLOSED:
            return {
                action: "NO_ACTION",
                reason: "Recovery case is already closed.",
            };

        default:
            return {
                action: "REVIEW_CASE",
                reason: "Unknown customer state.",
            };
    }
}

module.exports = {
    decideNextAction,
};