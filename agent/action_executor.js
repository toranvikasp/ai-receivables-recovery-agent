const { updateState } = require("./state_manager");
const { get, query, run } = require("../db");
const {
    sendEmail
} = require("../integrations/gmail/gmail_service");


/*
 * ============================================================
 * AUTOMATIC EMAIL SAFETY POLICY
 * ============================================================
 *
 * Only actions explicitly listed here may automatically
 * send customer emails.
 */

const AUTO_EMAIL_ACTIONS = new Set([
    "SEND_FOLLOW_UP"
]);


/**
 * Check whether an action may automatically send email.
 */
function isAutoEmailAllowed(action) {
    return AUTO_EMAIL_ACTIONS.has(action);
}


/**
 * Execute the next recovery action.
 */
async function executeAction(
    customerId,
    decision,
    responseMessage = null
) {

    /*
     * ========================================================
     * BASIC VALIDATION
     * ========================================================
     */

    if (!customerId) {
        return {
            success: false,
            email_sent: false,
            message: "Customer ID is required."
        };
    }

    if (!decision || !decision.action) {
        return {
            success: false,
            email_sent: false,
            message: "No action provided."
        };
    }


    const action =
        decision.action;


    /*
     * ========================================================
     * AUTOMATIC EMAIL SAFETY GATE
     * ========================================================
     */

    const emailAllowed =
        isAutoEmailAllowed(action);


    switch (action) {


        /*
         * ====================================================
         * ESCALATE TO RECOVERY TEAM
         * ====================================================
         */

        case "ESCALATE_TO_RECOVERY_TEAM": {

            updateState(customerId, {

                current_state:
                    "ESCALATED",

                next_action:
                    "ESCALATE_TO_RECOVERY_TEAM",

                escalated_to_human:
                    true,

                last_execution:
                    "Recovery case escalated to human recovery team."
            });


            return {

                success: true,

                action:
                    "ESCALATE_TO_RECOVERY_TEAM",

                email_sent:
                    false,

                message:
                    "Recovery case escalated to human recovery team."
            };
        }


        /*
         * ====================================================
         * CLOSE CASE
         * ====================================================
         */

        case "CLOSE_CASE": {

            updateState(customerId, {

                current_state:
                    "CLOSED",

                next_action:
                    "NO_ACTION",

                last_execution:
                    "Recovery case closed.",

                escalated_to_human:
                    false,

                last_outbound_message:
                    null
            });


            return {

                success: true,

                action:
                    "CLOSE_CASE",

                email_sent:
                    false,

                message:
                    "Recovery case closed."
            };
        }


        /*
         * ====================================================
         * FOLLOW UP LATER
         * ====================================================
         */

        case "FOLLOW_UP_LATER": {

            updateState(customerId, {

                current_state:
                    "FOLLOW_UP_DUE",

                next_action:
                    "SEND_FOLLOW_UP",

                last_execution:
                    "Follow-up scheduled for later.",

                escalated_to_human:
                    false
            });


            return {

                success: true,

                action:
                    "FOLLOW_UP_LATER",

                email_sent:
                    false,

                message:
                    "Follow-up scheduled for later."
            };
        }


        /*
         * ====================================================
         * SEND FOLLOW UP
         * ====================================================
         */

        case "SEND_FOLLOW_UP": {

            /*
             * Safety gate.
             */

            if (!emailAllowed) {

                console.warn(
                    "[AGENT SAFETY] Automatic email blocked:",
                    action
                );


                return {

                    success: false,

                    action:
                        "SEND_FOLLOW_UP",

                    email_sent:
                        false,

                    message:
                        "Automatic email blocked by safety policy."
                };
            }


            const followUpMessage =
                responseMessage ||
                "Please provide an update on the outstanding payment.";


            /*
             * Find customer.
             */

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
                    LIMIT 1
                    `,
                    [customerId]
                );


            if (!customer) {

                return {

                    success: false,

                    action:
                        "SEND_FOLLOW_UP",

                    email_sent:
                        false,

                    message:
                        "Customer not found."
                };
            }


            if (!customer.email) {

                return {

                    success: false,

                    action:
                        "SEND_FOLLOW_UP",

                    email_sent:
                        false,

                    message:
                        "Customer email address not found."
                };
            }


            /*
             * Send email.
             */

            let gmailResult;


            try {

                gmailResult =
                    await sendEmail({

                        to:
                            customer.email,

                        subject:
                            "Payment Recovery Update",

                        body:
                            followUpMessage
                    });

            } catch (error) {

                console.error(
                    "[GMAIL AUTO] Failed to send follow-up:",
                    error.message
                );


                return {

                    success: false,

                    action:
                        "SEND_FOLLOW_UP",

                    email_sent:
                        false,

                    message:
                        "Recovery email failed to send.",

                    error:
                        error.message
                };
            }


            /*
             * Only update state after Gmail confirms
             * successful delivery.
             */

            updateState(customerId, {

                current_state:
                    "CONTACTED",

                next_action:
                    "WAIT_FOR_CUSTOMER_RESPONSE",

                last_execution:
                    "AI recovery follow-up automatically sent via Gmail.",

                last_outbound_message:
                    followUpMessage,

                escalated_to_human:
                    false
            });


            console.log(
                "[GMAIL AUTO] Recovery follow-up sent:",
                gmailResult.id
            );


            return {

                success: true,

                action:
                    "SEND_FOLLOW_UP",

                email_sent:
                    true,

                message:
                    "AI recovery follow-up automatically sent via Gmail.",

                outbound_message:
                    followUpMessage,

                gmail_message_id:
                    gmailResult.id,

                gmail_thread_id:
                    gmailResult.threadId ||
                    null
            };
        }


        /*
         * ====================================================
         * VERIFY PAYMENT RECEIPT
         * ====================================================
         *
         * Customer claims payment was made.
         *
         * We verify against:
         *
         * 1. Customer invoice
         * 2. ALL completed payments for that invoice
         * 3. Total completed payment amount
         *
         * We DO NOT blindly trust the customer's message.
         */

        case "VERIFY_PAYMENT_RECEIPT": {

            const verificationMessage =
                responseMessage ||
                "Thank you for informing us about the payment. We will verify the transaction and update your account once confirmed.";


            /*
             * =================================================
             * 1. FIND RELEVANT INVOICE
             * =================================================
             *
             * Prefer an unpaid/partially-paid invoice.
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
                    [customerId]
                );


            /*
             * No invoice.
             */

            if (!invoice) {

                updateState(customerId, {

                    current_state:
                        "FOLLOW_UP_DUE",

                    next_action:
                        "SEND_FOLLOW_UP",

                    last_execution:
                        "Payment verification failed because no invoice was found.",

                    last_outbound_message:
                        verificationMessage,

                    escalated_to_human:
                        false
                });


                return {

                    success: false,

                    action:
                        "VERIFY_PAYMENT_RECEIPT",

                    email_sent:
                        false,

                    verification_status:
                        "NO_INVOICE",

                    message:
                        "No invoice found for payment verification.",

                    outbound_message:
                        verificationMessage
                };
            }


            /*
             * =================================================
             * 2. GET ALL COMPLETED PAYMENTS
             * =================================================
             *
             * IMPORTANT:
             *
             * We do NOT use LIMIT 1 here.
             *
             * A customer can make multiple payments.
             */

            const paymentSummary =
                await get(
                    `
                    SELECT
                        COUNT(*) AS payment_count,
                        COALESCE(
                            SUM(payment_amount),
                            0
                        ) AS total_completed
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


            const paymentCount =
                Number(
                    paymentSummary?.payment_count ||
                    0
                );


            const totalCompletedPayments =
                Number(
                    paymentSummary?.total_completed ||
                    0
                );


            const invoiceAmount =
                Number(
                    invoice.invoice_amount ||
                    0
                );


            const databaseAmountPaid =
                Number(
                    invoice.amount_paid ||
                    0
                );


            /*
             * Calculate remaining balance using the
             * completed payment ledger.
             */

            const remainingBalance =
                Math.max(
                    0,
                    invoiceAmount -
                    totalCompletedPayments
                );


            /*
             * =================================================
             * 3. DETERMINE PAYMENT STATUS
             * =================================================
             *
             * A payment is considered fully verified if:
             *
             * A) invoice says PAID / zero outstanding
             *
             * OR
             *
             * B) completed payment ledger covers the
             *    complete invoice amount.
             */

            const invoiceAlreadyPaid =
                invoice.payment_status === "PAID" ||
                Number(
                    invoice.amount_outstanding || 0
                ) <= 0;


            const ledgerFullyPaid =
                invoiceAmount > 0 &&
                totalCompletedPayments >=
                invoiceAmount;


            /*
 * =================================================
 * 4. FULLY VERIFIED
 * =================================================
 */

            if (
                invoiceAlreadyPaid ||
                ledgerFullyPaid
            ) {

                /*
                 * Synchronize the invoice record with the
                 * verified payment ledger.
                 *
                 * The payment ledger is the source of truth.
                 */
                await run(
                    `
                    UPDATE invoices
                    SET
                        amount_paid = ?,
                        amount_outstanding = ?,
                        payment_status = 'PAID'
                    WHERE id = ?
                    `,
                    [
                        invoiceAmount,
                        0,
                        invoice.id
                    ]
                );

                console.log(
                    "[PAYMENT VERIFY] Invoice synchronized to PAID."
                );

                console.log(
                    "[PAYMENT VERIFY] Invoice:",
                    invoice.id
                );

                console.log(
                    "[PAYMENT VERIFY] Invoice amount:",
                    invoiceAmount
                );

                console.log(
                    "[PAYMENT VERIFY] Completed payments:",
                    totalCompletedPayments
                );


                updateState(customerId, {

                    current_state:
                        "PAID",

                    promised_date:
                        null,

                    last_intent:
                        "PAYMENT_RECEIVED",

                    next_action:
                        "CLOSE_CASE",

                    last_execution:
                        "Payment fully verified against the invoice and completed payment ledger.",

                    last_outbound_message:
                        verificationMessage,

                    escalated_to_human:
                        false
                });


                console.log(
                    "[PAYMENT VERIFY] Payment fully verified."
                );


                return {

                    success: true,

                    action:
                        "VERIFY_PAYMENT_RECEIPT",

                    email_sent:
                        false,

                    verification_status:
                        "VERIFIED",

                    invoice_id:
                        invoice.id,

                    invoice_amount:
                        invoiceAmount,

                    database_amount_paid:
                        invoiceAmount,

                    total_completed_payments:
                        totalCompletedPayments,

                    amount_outstanding:
                        0,

                    payment_count:
                        paymentCount,

                    message:
                        "Payment fully verified. Invoice is paid.",

                    outbound_message:
                        verificationMessage
                };
            }

            /*
             * =================================================
             * 5. PARTIAL PAYMENT / NOT FULLY VERIFIED
             * =================================================
             *
             * Example:
             *
             * Invoice = $8,200
             * Completed payments = $4,000
             * Remaining = $4,200
             */

            updateState(customerId, {

                current_state:
                    "FOLLOW_UP_DUE",

                next_action:
                    "SEND_FOLLOW_UP",

                last_execution:
                    "Customer claimed payment, but completed payments do not fully cover the invoice.",

                last_outbound_message:
                    verificationMessage,

                escalated_to_human:
                    false
            });


            console.log(
                "[PAYMENT VERIFY] Payment not fully verified."
            );

            console.log(
                "[PAYMENT VERIFY] Invoice:",
                invoice.id
            );

            console.log(
                "[PAYMENT VERIFY] Invoice amount:",
                invoiceAmount
            );

            console.log(
                "[PAYMENT VERIFY] Completed payments:",
                totalCompletedPayments
            );

            console.log(
                "[PAYMENT VERIFY] Remaining balance:",
                remainingBalance
            );


            return {

                success: true,

                action:
                    "VERIFY_PAYMENT_RECEIPT",

                email_sent:
                    false,

                verification_status:
                    totalCompletedPayments > 0
                        ? "PARTIALLY_VERIFIED"
                        : "NOT_VERIFIED",

                invoice_id:
                    invoice.id,

                invoice_amount:
                    invoiceAmount,

                database_amount_paid:
                    databaseAmountPaid,

                total_completed_payments:
                    totalCompletedPayments,

                amount_outstanding:
                    remainingBalance,

                payment_count:
                    paymentCount,

                message:
                    totalCompletedPayments > 0
                        ? "Payment was partially verified. An outstanding balance remains."
                        : "Payment could not be verified. No completed payment was found.",

                outbound_message:
                    verificationMessage
            };
        }


        /*
         * ====================================================
         * WAIT FOR PAYMENT
         * ====================================================
         */

        case "WAIT_FOR_PAYMENT": {

            updateState(customerId, {

                next_action:
                    "WAIT_FOR_PAYMENT",

                last_execution:
                    "Agent is waiting for the promised payment."
            });


            return {

                success: true,

                action:
                    "WAIT_FOR_PAYMENT",

                email_sent:
                    false,

                message:
                    "Agent is waiting for the promised payment."
            };
        }


        /*
         * ====================================================
         * CHECK PAYMENT STATUS
         * ====================================================
         */

        case "CHECK_PAYMENT_STATUS": {

            const invoice =
                await get(
                    `
                    SELECT
                        id,
                        invoice_amount,
                        amount_paid,
                        amount_outstanding,
                        payment_status
                    FROM invoices
                    WHERE customer_id = ?
                    ORDER BY due_date DESC
                    LIMIT 1
                    `,
                    [customerId]
                );


            if (!invoice) {

                updateState(customerId, {

                    current_state:
                        "FOLLOW_UP_DUE",

                    next_action:
                        "SEND_FOLLOW_UP",

                    last_execution:
                        "No invoice found for payment verification."
                });


                return {

                    success: false,

                    action:
                        "CHECK_PAYMENT_STATUS",

                    email_sent:
                        false,

                    message:
                        "No invoice found for payment verification."
                };
            }


            /*
             * Verify using the complete payment ledger
             * rather than trusting invoice.amount_paid alone.
             */

            const paymentSummary =
                await get(
                    `
                    SELECT
                        COALESCE(
                            SUM(payment_amount),
                            0
                        ) AS total_completed
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
                    paymentSummary?.total_completed ||
                    0
                );


            const invoiceAmount =
                Number(
                    invoice.invoice_amount ||
                    0
                );


            const isPaid =
                invoice.payment_status === "PAID" ||
                Number(
                    invoice.amount_outstanding || 0
                ) <= 0 ||
                (
                    invoiceAmount > 0 &&
                    totalCompletedPayments >=
                    invoiceAmount
                );


            if (isPaid) {

                updateState(customerId, {

                    current_state:
                        "PAID",

                    promised_date:
                        null,

                    last_intent:
                        "PAYMENT_RECEIVED",

                    next_action:
                        "CLOSE_CASE",

                    last_execution:
                        "Payment verified successfully.",

                    escalated_to_human:
                        false
                });


                return {

                    success: true,

                    action:
                        "CHECK_PAYMENT_STATUS",

                    email_sent:
                        false,

                    verification_status:
                        "VERIFIED",

                    invoice_id:
                        invoice.id,

                    total_completed_payments:
                        totalCompletedPayments,

                    message:
                        "Payment verified successfully. Invoice is paid."
                };
            }


            /*
             * Still outstanding.
             */

            const remainingBalance =
                Math.max(
                    0,
                    invoiceAmount -
                    totalCompletedPayments
                );


            updateState(customerId, {

                current_state:
                    "FOLLOW_UP_DUE",

                next_action:
                    "SEND_FOLLOW_UP",

                last_execution:
                    "Payment not fully received. Follow-up is now due.",

                escalated_to_human:
                    false
            });


            return {

                success: true,

                action:
                    "CHECK_PAYMENT_STATUS",

                email_sent:
                    false,

                verification_status:
                    totalCompletedPayments > 0
                        ? "PARTIALLY_PAID"
                        : "UNPAID",

                invoice_id:
                    invoice.id,

                total_completed_payments:
                    totalCompletedPayments,

                amount_outstanding:
                    remainingBalance,

                message:
                    "Payment not fully received. Follow-up is now due."
            };
        }


        /*
         * ====================================================
         * UNKNOWN / UNSUPPORTED ACTION
         * ====================================================
         */

        default: {

            console.warn(
                "[AGENT SAFETY] Unknown action blocked:",
                action
            );


            return {

                success: false,

                action:
                    action,

                email_sent:
                    false,

                message:
                    "Action is not implemented and was blocked by the safety policy."
            };
        }
    }
}


module.exports = {
    executeAction,
    isAutoEmailAllowed
};