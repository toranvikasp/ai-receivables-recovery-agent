const {
    STATES,
    getState,
    updateState,
} = require("./state_manager");

const {
    markFollowUpDue,
    markPaid,
} = require("./state_transition_engine");

const {
    decideNextAction,
} = require("./action_engine");

const {
    executeAction,
} = require("./action_executor");

const {
    query,
    get,
} = require("../db");


/*
 * ============================================================
 * DATE HELPERS
 * ============================================================
 */

/**
 * Return today's date at midnight.
 */
function startOfToday() {
    const date = new Date();

    date.setHours(
        0,
        0,
        0,
        0
    );

    return date;
}


/**
 * Convert a supported promise date into a Date.
 *
 * Supported values:
 *
 * TOMORROW
 * TODAY
 * YYYY-MM-DD
 * ISO date strings
 */
function resolvePromiseDate(promisedDate) {

    if (!promisedDate) {
        return null;
    }

    const normalized =
        String(promisedDate)
            .trim()
            .toUpperCase();


    /*
     * --------------------------------------------------------
     * TODAY
     * --------------------------------------------------------
     */

    if (normalized === "TODAY") {

        return startOfToday();
    }


    /*
     * --------------------------------------------------------
     * TOMORROW
     * --------------------------------------------------------
     */

    if (normalized === "TOMORROW") {

        const tomorrow =
            startOfToday();

        tomorrow.setDate(
            tomorrow.getDate() + 1
        );

        return tomorrow;
    }


    /*
     * --------------------------------------------------------
     * NONE / NULL-LIKE VALUES
     * --------------------------------------------------------
     */

    if (
        normalized === "NONE" ||
        normalized === "NULL" ||
        normalized === "N/A"
    ) {

        return null;
    }


    /*
     * --------------------------------------------------------
     * NORMAL DATE
     * --------------------------------------------------------
     */

    const parsedDate =
        new Date(promisedDate);


    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {

        return null;
    }


    parsedDate.setHours(
        0,
        0,
        0,
        0
    );


    return parsedDate;
}


/*
 * ============================================================
 * CHECK WHETHER A PROMISE DATE IS DUE
 * ============================================================
 */

function isPromiseDue(promisedDate) {

    const promiseDate =
        resolvePromiseDate(
            promisedDate
        );


    if (!promiseDate) {
        return false;
    }


    const today =
        startOfToday();


    return today >= promiseDate;
}


/*
 * ============================================================
 * CHECK WHETHER PAYMENT IS FULLY RECEIVED
 * ============================================================
 *
 * IMPORTANT:
 *
 * The agent does NOT trust:
 *
 * - customer's statement
 * - invoice.amount_paid alone
 * - current state alone
 *
 * It verifies against the completed payment ledger.
 *
 * ============================================================
 */

async function verifyCustomerPayment(
    customerId
) {

    /*
     * --------------------------------------------------------
     * Find the most relevant invoice.
     * --------------------------------------------------------
     */

    const invoice =
        await get(
            `
                SELECT
                    id,
                    invoice_amount,
                    amount_paid,
                    amount_outstanding,
                    payment_status,
                    issue_date,
                    due_date
                FROM invoices
                WHERE customer_id = ?
                ORDER BY
                    CASE
                        WHEN payment_status = 'OVERDUE'
                            THEN 0

                        WHEN payment_status = 'PARTIALLY_PAID'
                            THEN 1

                        WHEN payment_status = 'PENDING'
                            THEN 2

                        WHEN payment_status = 'PAID'
                            THEN 3

                        ELSE 4
                    END,
                    due_date DESC
                LIMIT 1
            `,
            [
                customerId
            ]
        );


    /*
     * --------------------------------------------------------
     * No invoice.
     * --------------------------------------------------------
     */

    if (!invoice) {

        return {
            found: false,
            paid: false,
            partiallyPaid: false,
            invoice: null,
            invoiceAmount: 0,
            databaseAmountPaid: 0,
            totalCompletedPayments: 0,
            amountOutstanding: null,
            paymentCount: 0,
        };
    }


    /*
     * --------------------------------------------------------
     * Get completed payment ledger.
     * --------------------------------------------------------
     */

    const paymentSummary =
        await get(
            `
                SELECT
                    COALESCE(
                        SUM(payment_amount),
                        0
                    ) AS total_completed,

                    COUNT(*) AS payment_count

                FROM payments

                WHERE invoice_id = ?
                  AND customer_id = ?
                  AND payment_status = 'COMPLETED'
            `,
            [
                invoice.id,
                customerId
            ]
        );


    const totalCompletedPayments =
        Number(
            paymentSummary?.total_completed || 0
        );


    const paymentCount =
        Number(
            paymentSummary?.payment_count || 0
        );


    const invoiceAmount =
        Number(
            invoice.invoice_amount || 0
        );


    const databaseAmountPaid =
        Number(
            invoice.amount_paid || 0
        );


    /*
     * --------------------------------------------------------
     * Calculate actual balance.
     *
     * The completed payment ledger is the source of truth.
     * --------------------------------------------------------
     */

    const amountOutstanding =
        Math.max(
            0,
            invoiceAmount -
            totalCompletedPayments
        );


    /*
     * --------------------------------------------------------
     * Determine payment status.
     * --------------------------------------------------------
     */

    const paid =
        invoiceAmount > 0 &&
        totalCompletedPayments >=
        invoiceAmount;


    const partiallyPaid =
        totalCompletedPayments > 0 &&
        totalCompletedPayments <
        invoiceAmount;


    return {

        found: true,

        paid,

        partiallyPaid,

        invoice,

        invoiceId:
            invoice.id,

        invoiceAmount,

        databaseAmountPaid,

        totalCompletedPayments,

        amountOutstanding,

        paymentCount,
    };
}


/*
 * ============================================================
 * CHECK ONE CUSTOMER PROMISE
 * ============================================================
 */

async function checkPromise(
    customerId,
    paymentReceived = false
) {

    const state =
        getState(
            customerId
        );


    /*
     * --------------------------------------------------------
     * Ignore missing state.
     * --------------------------------------------------------
     */

    if (!state) {

        return null;
    }


    /*
     * --------------------------------------------------------
     * Explicit payment confirmation.
     *
     * We still use markPaid here because the caller is
     * explicitly telling the checker that payment was received.
     * --------------------------------------------------------
     */

    if (paymentReceived) {

        return markPaid(
            customerId,
            "Payment received."
        );
    }


    /*
     * --------------------------------------------------------
     * Already closed / paid.
     * --------------------------------------------------------
     */

    if (
        state.current_state ===
        STATES.CLOSED ||

        state.current_state ===
        STATES.PAID
    ) {

        return state;
    }


    /*
     * --------------------------------------------------------
     * Only monitor payment-promise states.
     * --------------------------------------------------------
     */

    if (
        state.current_state !==
        STATES.PROMISED_PAYMENT &&

        state.current_state !==
        STATES.WAITING_FOR_PAYMENT
    ) {

        return state;
    }


    /*
     * --------------------------------------------------------
     * No promise date = nothing to check.
     * --------------------------------------------------------
     */

    if (
        !state.promised_date
    ) {

        return state;
    }


    /*
     * --------------------------------------------------------
     * Check due date.
     * --------------------------------------------------------
     */

    const due =
        isPromiseDue(
            state.promised_date
        );


    if (!due) {

        return state;
    }


    /*
     * ========================================================
     * PROMISE IS DUE
     * ========================================================
     */

    console.log(
        `[PROMISE AUTO] Promise due for ${customerId}.`
    );


    /*
     * --------------------------------------------------------
     * Verify actual payment.
     * --------------------------------------------------------
     */

    const payment =
        await verifyCustomerPayment(
            customerId
        );


    /*
     * ========================================================
     * PAYMENT FULLY VERIFIED
     * ========================================================
     */

    if (payment.paid) {

        console.log(
            `[PROMISE AUTO] Payment verified for ${customerId}.`
        );

        console.log(
            `[PROMISE AUTO] Invoice: ${payment.invoiceId}`
        );

        console.log(
            `[PROMISE AUTO] Invoice amount: ${payment.invoiceAmount}`
        );

        console.log(
            `[PROMISE AUTO] Completed payments: ${payment.totalCompletedPayments}`
        );


        /*
         * ----------------------------------------------------
         * Mark paid.
         * ----------------------------------------------------
         */

        const paidState =
            markPaid(
                customerId,
                "Promised payment was verified in the completed payment ledger."
            );


        /*
         * ----------------------------------------------------
         * Save verification details.
         * ----------------------------------------------------
         */

        updateState(
            customerId,
            {

                last_execution:
                    "Promised payment was verified in the payment ledger. Recovery case closed.",

                next_action:
                    "CLOSE_CASE",

                promised_date:
                    null,
            }
        );


        return getState(
            customerId
        );
    }


    /*
     * ========================================================
     * PAYMENT NOT FULLY RECEIVED
     * ========================================================
     */

    console.log(
        `[PROMISE AUTO] Payment not fully received for ${customerId}.`
    );


    if (
        payment.partiallyPaid
    ) {

        console.log(
            `[PROMISE AUTO] Partial payment detected: ${payment.totalCompletedPayments}/${payment.invoiceAmount}`
        );

    } else {

        console.log(
            `[PROMISE AUTO] No completed payment found.`
        );
    }


    console.log(
        `[PROMISE AUTO] Remaining balance: ${payment.amountOutstanding}`
    );


    /*
     * --------------------------------------------------------
     * Move case into follow-up.
     * --------------------------------------------------------
     */

    const followUpState =
        markFollowUpDue(
            customerId
        );


    /*
     * --------------------------------------------------------
     * Decide what the agent should do next.
     * --------------------------------------------------------
     */

    const decision =
        decideNextAction(
            followUpState
        );


    console.log(
        `[PROMISE AUTO] Decision for ${customerId}:`,
        decision.action
    );


    /*
     * ========================================================
     * SEND FOLLOW-UP
     * ========================================================
     */

    if (
        decision.action ===
        "SEND_FOLLOW_UP"
    ) {

        const balance =
            payment.amountOutstanding !== null
                ? payment.amountOutstanding
                : null;


        let followUpMessage;


        if (
            balance !== null
        ) {

            followUpMessage =
                `Dear Customer,

This is a follow-up regarding the outstanding payment on your account.

Our records indicate that the payment promised for ${state.promised_date} has not yet been fully received.

The remaining outstanding balance is ${balance}.

Please provide an update on the payment status at your earliest convenience.

If the payment has already been transferred, please share the transaction details so our accounts team can verify it.

Thank you.`;

        } else {

            followUpMessage =
                `Dear Customer,

This is a follow-up regarding the payment you previously committed to make.

Our records do not yet show full receipt of the payment.

Please provide an update on the payment status at your earliest convenience.

If the payment has already been transferred, please share the transaction details so our accounts team can verify it.

Thank you.`;
        }


        /*
         * ----------------------------------------------------
         * Execute through the central action executor.
         * ----------------------------------------------------
         */

        const execution =
            await executeAction(
                customerId,
                decision,
                followUpMessage
            );


        /*
         * ----------------------------------------------------
         * Save execution result.
         * ----------------------------------------------------
         */

        updateState(
            customerId,
            {

                last_execution:
                    execution.success

                        ? (
                            payment.partiallyPaid
                                ? "Automatic follow-up sent because promised payment was only partially received."
                                : "Automatic follow-up sent because promised payment was not received."
                        )

                        : `Automatic follow-up attempt failed: ${execution.message}`,
            }
        );


        return getState(
            customerId
        );
    }


    return followUpState;
}


/*
 * ============================================================
 * CHECK ALL CUSTOMER PROMISES
 * ============================================================
 */

async function checkAllPromises() {

    /*
     * --------------------------------------------------------
     * Load all CRM customers.
     * --------------------------------------------------------
     */

    const customers =
        await query(
            `
                SELECT id
                FROM customers
                ORDER BY id
            `
        );


    let checked = 0;

    let changed = 0;

    const results = [];


    /*
     * --------------------------------------------------------
     * Check each customer independently.
     * --------------------------------------------------------
     */

    for (
        const customer of customers
    ) {

        checked++;


        try {

            const before =
                getState(
                    customer.id
                );


            const beforeState =
                before?.current_state;


            const beforeAction =
                before?.next_action;


            const after =
                await checkPromise(
                    customer.id
                );


            if (!after) {
                continue;
            }


            const afterState =
                after.current_state;


            const afterAction =
                after.next_action;


            /*
             * ------------------------------------------------
             * Record any meaningful state/action change.
             * ------------------------------------------------
             */

            if (
                beforeState !==
                afterState ||

                beforeAction !==
                afterAction
            ) {

                changed++;


                results.push({

                    customer_id:
                        customer.id,

                    previous_state:
                        beforeState,

                    current_state:
                        afterState,

                    previous_action:
                        beforeAction,

                    next_action:
                        afterAction,

                    promised_date:
                        after.promised_date,

                });
            }


        } catch (error) {

            console.error(
                `[PROMISE AUTO] Failed checking ${customer.id}:`,
                error.message
            );

            results.push({

                customer_id:
                    customer.id,

                error:
                    error.message,
            });
        }
    }


    return {

        checked,

        changed,

        results,
    };
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {

    isPromiseDue,

    resolvePromiseDate,

    checkPromise,

    checkAllPromises,

    verifyCustomerPayment,
};