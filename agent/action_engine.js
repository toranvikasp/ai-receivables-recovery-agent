const { STATES } = require("./state_manager");


/*
 * ============================================================
 * ACTION ENGINE
 * ============================================================
 *
 * Decides what the receivables recovery agent should do next.
 *
 * IMPORTANT:
 * This file decides actions.
 * It does NOT execute emails or payments.
 *
 * Actual execution is handled by action_executor.js.
 */


/*
 * ============================================================
 * HELPER: BUILD DECISION
 * ============================================================
 */

function decision(
    action,
    reason,
    priority = "NORMAL",
    requiresHuman = false
) {

    return {
        action,
        reason,
        priority,
        requires_human: requiresHuman,
    };
}


/*
 * ============================================================
 * MAIN DECISION ENGINE
 * ============================================================
 */

function decideNextAction(state) {

    if (!state) {

        return decision(
            "REVIEW_CASE",
            "No recovery state was provided.",
            "HIGH",
            true
        );
    }


    switch (
    state.current_state
    ) {


        /*
         * ====================================================
         * OVERDUE
         * ====================================================
         */

        case STATES.OVERDUE:

            return decision(
                "CONTACT_CUSTOMER",
                "Invoice is overdue and customer has not been contacted.",
                "NORMAL",
                false
            );


        /*
         * ====================================================
         * CONTACTED
         * ====================================================
         */

        case STATES.CONTACTED:

            return decision(
                "WAIT_FOR_CUSTOMER_RESPONSE",
                "Customer has been contacted and the agent should wait for a response.",
                "NORMAL",
                false
            );


        /*
         * ====================================================
         * PROMISED PAYMENT
         * ====================================================
         */

        case STATES.PROMISED_PAYMENT:

            return decision(
                "WAIT_FOR_PAYMENT",
                `Customer promised payment for ${state.promised_date || "the agreed date"}.`,
                "NORMAL",
                false
            );


        /*
         * ====================================================
         * WAITING FOR PAYMENT
         * ====================================================
         */

        case STATES.WAITING_FOR_PAYMENT:

            /*
             * Customer reported that payment was made.
             *
             * Never mark the invoice paid based only on the
             * customer's message.
             *
             * The payment verifier must check the database.
             */

            if (
                state.last_intent ===
                "PAYMENT_MADE" ||

                state.last_intent ===
                "ALREADY_PAID" ||

                state.next_action ===
                "VERIFY_PAYMENT_RECEIPT"
            ) {

                return decision(
                    "VERIFY_PAYMENT_RECEIPT",
                    "Customer reported that payment has been made. Verify the payment against the payment ledger.",
                    "HIGH",
                    false
                );
            }


            return decision(
                "CHECK_PAYMENT_STATUS",
                "Customer has promised payment and the system should verify the payment status.",
                "NORMAL",
                false
            );


        /*
         * ====================================================
         * FOLLOW-UP DUE
         * ====================================================
         */

        case STATES.FOLLOW_UP_DUE:

            return decision(
                "SEND_FOLLOW_UP",
                "Promised payment has not arrived by the expected date.",
                "HIGH",
                false
            );


        /*
         * ====================================================
         * ESCALATED
         * ====================================================
         */

        case STATES.ESCALATED:

            return decision(
                "ESCALATE_TO_RECOVERY_TEAM",
                "Customer requires human intervention.",
                "CRITICAL",
                true
            );


        /*
         * ====================================================
         * PAID
         * ====================================================
         */

        case STATES.PAID:

            return decision(
                "CLOSE_CASE",
                "Payment has been received and the recovery case can be closed.",
                "NORMAL",
                false
            );


        /*
         * ====================================================
         * CLOSED
         * ====================================================
         */

        case STATES.CLOSED:

            return decision(
                "NO_ACTION",
                "Recovery case is already closed.",
                "NORMAL",
                false
            );


        /*
         * ====================================================
         * UNKNOWN STATE
         * ====================================================
         */

        default:

            return decision(
                "REVIEW_CASE",
                `Unknown recovery state: ${state.current_state}. Human review is required.`,
                "CRITICAL",
                true
            );
    }
}


/*
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = {
    decideNextAction,
};