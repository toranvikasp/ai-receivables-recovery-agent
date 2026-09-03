const { analyzeCustomerReply } = require("../ai-engine/conversation_analyzer");

const {
    recordPromise,
    markPaymentReceived,
    updateState,
    getState,
} = require("./state_manager");

const {
    markPaymentClaimed,
    markEscalated,
    markFollowUpDue,
} = require("./state_transition_engine");

const {
    decideNextAction,
} = require("./action_engine");

const {
    executeAction,
} = require("./action_executor");

const {
    recordAuditEvent,
} = require("../db");


/**
 * ============================================================
 * AUDIT HELPER
 * ============================================================
 *
 * Audit logging must NEVER break the recovery agent.
 *
 * If the audit database has a problem, the actual recovery
 * workflow should continue and only the audit warning is shown.
 */

async function safeAudit(event) {

    try {

        await recordAuditEvent(event);

    } catch (error) {

        console.error(
            "[AUDIT] Failed to record event:",
            error.message
        );
    }
}


/**
 * ============================================================
 * PROCESS CUSTOMER MESSAGE
 * ============================================================
 */

async function processCustomerMessage(context) {

    /*
     * ========================================================
     * 1. VALIDATE INPUT
     * ========================================================
     */

    if (!context) {

        throw new Error(
            "Customer context is required."
        );
    }

    if (!context.customer_id) {

        throw new Error(
            "Customer ID is required."
        );
    }

    if (!context.message) {

        throw new Error(
            "Customer message is required."
        );
    }


    const customerId =
        context.customer_id;


    /*
     * ========================================================
     * 2. GET PREVIOUS STATE
     * ========================================================
     */

    const previousState =
        getState(customerId);


    /*
     * ========================================================
     * 3. AI ANALYSIS
     * ========================================================
     */

    const analysisResult =
        await analyzeCustomerReply(context);

    const analysis =
        analysisResult.data;


    if (!analysis) {

        throw new Error(
            "AI analysis returned no data."
        );
    }
    /*
 * ========================================================
 * 3.5 AI SAFETY GATE
 * ========================================================
 *
 * Customer messages are UNTRUSTED INPUT.
 *
 * The LLM may interpret the message, but the message itself
 * must never be allowed to directly change financial state
 * or bypass deterministic business rules.
 *
 * Low-confidence or suspicious requests are routed to
 * human review instead of continuing automatically.
 */

    const AI_CONFIDENCE_THRESHOLD = 0.70;

    const confidence =
        Number(analysis.confidence);

    const customerMessage =
        String(context.message || "");

    /*
     * Detect attempts to directly manipulate financial/system
     * state through customer-provided text.
     *
     * This is intentionally conservative: detection does not
     * itself change financial records; it only forces review.
     */

    const suspiciousFinancialInstruction =
        /\b(ignore|bypass|override|disable|skip)\b[\s\S]{0,80}\b(previous|rules|instructions|verification|approval|policy)\b/i.test(customerMessage)
        ||
        /\b(mark|set|change|update)\b[\s\S]{0,80}\b(invoice|payment|balance|account|amount)\b[\s\S]{0,80}\b(paid|zero|closed|approved|verified)\b/i.test(customerMessage);


    const lowConfidence =
        !Number.isFinite(confidence) ||
        confidence < AI_CONFIDENCE_THRESHOLD;

    const aiRequestedEscalation =
        Boolean(
            analysis.escalation_required
        );

    const safetyReviewRequired =
        lowConfidence ||
        aiRequestedEscalation ||
        suspiciousFinancialInstruction;


    if (safetyReviewRequired) {

        const safetyReason =
            suspiciousFinancialInstruction
                ? "Customer message contains a suspicious attempt to influence financial or system state."
                : lowConfidence
                    ? `AI confidence ${Number.isFinite(confidence) ? confidence.toFixed(2) : "INVALID"} is below the ${AI_CONFIDENCE_THRESHOLD.toFixed(2)} safety threshold.`
                    : "AI analysis explicitly requested escalation.";


        await safeAudit({

            customerId,

            eventType:
                "AI_SAFETY_BLOCK",

            previousState:
                previousState.current_state,

            newState:
                previousState.current_state,

            intent:
                analysis.intent ||
                null,

            action:
                "ESCALATE_TO_HUMAN",

            priority:
                "CRITICAL",

            requiresHuman:
                true,

            success:
                true,

            reason:
                safetyReason,

            message:
                context.message,

            metadata: {

                confidence:
                    Number.isFinite(confidence)
                        ? confidence
                        : null,

                confidence_threshold:
                    AI_CONFIDENCE_THRESHOLD,

                low_confidence:
                    lowConfidence,

                suspicious_financial_instruction:
                    suspiciousFinancialInstruction,

                ai_requested_escalation:
                    aiRequestedEscalation
            }
        });


        updateState(

            customerId,

            {

                current_state:
                    "ESCALATED",

                promised_date:
                    previousState.promised_date ||
                    null,

                last_intent:
                    analysis.intent ||
                    null,

                next_action:
                    "ESCALATE_TO_RECOVERY_TEAM",

                last_execution:
                    safetyReason,

                last_outbound_message:
                    null,

                escalated_to_human:
                    true
            }

        );


        console.log(
            "[AI SAFETY] Automatic execution blocked."
        );

        console.log(
            "[AI SAFETY] Reason:",
            safetyReason
        );


        return {

            analysis,

            state:
                getState(customerId),

            decision: {

                action:
                    "ESCALATE_TO_HUMAN",

                reason:
                    safetyReason,

                priority:
                    "CRITICAL",

                requires_human:
                    true
            },

            execution: {

                success:
                    true,

                action:
                    "ESCALATE_TO_HUMAN",

                email_sent:
                    false,

                blocked_by_safety:
                    true,

                message:
                    "Automatic action blocked. Human review required."
            },

            follow_up_decision:
                null,

            follow_up_execution:
                null
        };
    }


    /*
     * ========================================================
     * 4. AUDIT AI ANALYSIS
     * ========================================================
     */

    await safeAudit({

        customerId,

        eventType:
            "AI_ANALYSIS",

        previousState:
            previousState.current_state,

        newState:
            previousState.current_state,

        intent:
            analysis.intent,

        priority:
            analysis.escalation_required
                ? "CRITICAL"
                : "NORMAL",

        requiresHuman:
            Boolean(
                analysis.escalation_required
            ),

        success:
            true,

        reason:
            analysis.key_reasoning ||
            analysis.suggested_reply_summary ||
            null,

        message:
            context.message,

        metadata: {

            confidence:
                analysis.confidence,

            sentiment:
                analysis.sentiment,

            recommended_action:
                analysis.recommended_action,

            promised_date:
                analysis.promised_date || null
        }
    });


    /*
     * ========================================================
     * 5. SAVE CUSTOMER MESSAGE
     * ========================================================
     */

    updateState(

        customerId,

        {

            last_message:
                context.message,

            last_intent:
                analysis.intent,

            last_outbound_message:
                null,

            escalated_to_human:
                false
        }
    );


    /*
     * ========================================================
     * 6. HANDLE CUSTOMER INTENT
     * ========================================================
     */

    switch (analysis.intent) {


        /*
         * ----------------------------------------------------
         * PROMISE TO PAY
         * ----------------------------------------------------
         */

        case "PROMISE_TO_PAY": {

            recordPromise(

                customerId,

                context.message,

                analysis.promised_date ||
                "TOMORROW"
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * PAYMENT MADE
         * ----------------------------------------------------
         */

        case "PAYMENT_MADE": {

            markPaymentClaimed(

                customerId,

                context.message
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * ALREADY PAID
         * ----------------------------------------------------
         */

        case "ALREADY_PAID": {

            markPaymentClaimed(

                customerId,

                context.message
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * PAYMENT CONFIRMED
         * ----------------------------------------------------
         */

        case "PAYMENT_RECEIVED":
        case "PAID": {

            markPaymentReceived(

                customerId,

                context.message
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * PAYMENT DELAY
         * ----------------------------------------------------
         */

        case "PAYMENT_DELAY": {

            if (
                analysis.recommended_action ===
                "ESCALATE_TO_MANAGER"
            ) {

                markEscalated(
                    customerId
                );

            } else {

                markFollowUpDue(
                    customerId
                );
            }

            break;
        }


        /*
         * ----------------------------------------------------
         * DISPUTE
         * ----------------------------------------------------
         */

        case "DISPUTE": {

            markEscalated(
                customerId
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * REFUSAL TO PAY
         * ----------------------------------------------------
         */

        case "REFUSAL_TO_PAY": {

            markEscalated(
                customerId
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * REQUEST FOR INVOICE
         * ----------------------------------------------------
         */

        case "REQUEST_FOR_INVOICE": {

            updateState(

                customerId,

                {

                    last_execution:
                        "Customer requested an invoice. AI response prepared."
                }
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * REQUEST FOR PAYMENT LINK
         * ----------------------------------------------------
         */

        case "REQUEST_FOR_PAYMENT_LINK": {

            updateState(

                customerId,

                {

                    last_execution:
                        "Customer requested a payment link. AI response prepared."
                }
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * GENERAL QUERY
         * ----------------------------------------------------
         */

        case "GENERAL_QUERY": {

            updateState(

                customerId,

                {

                    last_execution:
                        "General customer query analyzed. Recovery state preserved."
                }
            );

            break;
        }


        /*
         * ----------------------------------------------------
         * UNKNOWN
         * ----------------------------------------------------
         */

        case "UNKNOWN":
        default: {

            updateState(

                customerId,

                {

                    last_execution:
                        "Customer message could not be confidently classified. Recovery state preserved."
                }
            );

            break;
        }
    }


    /*
     * ========================================================
     * 7. GET UPDATED STATE
     * ========================================================
     */

    const state =
        getState(customerId);


    /*
     * ========================================================
     * 8. AUDIT STATE CHANGE
     * ========================================================
     */

    if (
        previousState.current_state !==
        state.current_state
    ) {

        await safeAudit({

            customerId,

            eventType:
                "STATE_CHANGE",

            previousState:
                previousState.current_state,

            newState:
                state.current_state,

            intent:
                analysis.intent,

            success:
                true,

            reason:
                `Recovery state changed from ${previousState.current_state} to ${state.current_state}.`,

            message:
                context.message,

            metadata: {

                promised_date:
                    state.promised_date,

                next_action:
                    state.next_action
            }
        });
    }


    /*
     * ========================================================
     * 9. DECIDE PRIMARY ACTION
     * ========================================================
     */

    const decision =
        decideNextAction(state);


    /*
     * ========================================================
     * 10. AUDIT ACTION DECISION
     * ========================================================
     */

    await safeAudit({

        customerId,

        eventType:
            "ACTION_DECISION",

        previousState:
            state.current_state,

        newState:
            state.current_state,

        intent:
            analysis.intent,

        action:
            decision.action,

        priority:
            decision.priority ||
            "NORMAL",

        requiresHuman:
            Boolean(
                decision.requires_human
            ),

        success:
            true,

        reason:
            decision.reason,

        message:
            analysis.suggested_response ||
            null
    });


    /*
     * ========================================================
     * 11. EXECUTE PRIMARY ACTION
     * ========================================================
     */

    const execution =
        await executeAction(

            customerId,

            decision,

            analysis.suggested_response
        );


    /*
     * ========================================================
     * 12. AUDIT ACTION EXECUTION
     * ========================================================
     */

    await safeAudit({

        customerId,

        invoiceId:
            execution.invoice_id ||
            null,

        eventType:
            "ACTION_EXECUTED",

        previousState:
            state.current_state,

        newState:
            getState(customerId)
                .current_state,

        intent:
            analysis.intent,

        action:
            decision.action,

        priority:
            decision.priority ||
            "NORMAL",

        requiresHuman:
            Boolean(
                decision.requires_human
            ),

        success:
            Boolean(
                execution.success
            ),

        reason:
            execution.message ||
            decision.reason,

        message:
            execution.outbound_message ||
            analysis.suggested_response ||
            null,

        metadata: {

            verification_status:
                execution.verification_status ||
                null,

            email_sent:
                Boolean(
                    execution.email_sent
                ),

            payment_count:
                execution.payment_count ||
                null,

            amount_outstanding:
                execution.amount_outstanding ??
                null
        }
    });


    /*
     * ========================================================
     * 13. AUDIT PAYMENT VERIFICATION
     * ========================================================
     */

    if (
        execution.verification_status
    ) {

        await safeAudit({

            customerId,

            invoiceId:
                execution.invoice_id ||
                null,

            eventType:
                "PAYMENT_VERIFICATION",

            previousState:
                state.current_state,

            newState:
                getState(customerId)
                    .current_state,

            intent:
                analysis.intent,

            action:
                decision.action,

            priority:
                "HIGH",

            success:
                execution.success,

            reason:
                execution.message ||
                "Payment verification completed.",

            message:
                execution.outbound_message ||
                null,

            metadata: {

                verification_status:
                    execution.verification_status,

                invoice_amount:
                    execution.invoice_amount ??
                    null,

                database_amount_paid:
                    execution.database_amount_paid ??
                    null,

                total_completed_payments:
                    execution.total_completed_payments ??
                    null,

                amount_outstanding:
                    execution.amount_outstanding ??
                    null,

                payment_count:
                    execution.payment_count ??
                    null
            }
        });
    }


    /*
     * ========================================================
     * 14. SAFE FOLLOW-ON ACTION
     * ========================================================
     *
     * Only CLOSE_CASE is automatically allowed after
     * successful payment verification.
     */

    let followUpDecision =
        null;

    let followUpExecution =
        null;


    const stateAfterExecution =
        getState(customerId);


    if (

        decision.action ===
        "VERIFY_PAYMENT_RECEIPT" &&

        execution.success ===
        true &&

        execution.verification_status ===
        "VERIFIED" &&

        stateAfterExecution.current_state ===
        "PAID" &&

        stateAfterExecution.next_action ===
        "CLOSE_CASE"
    ) {

        followUpDecision = {

            action:
                "CLOSE_CASE",

            reason:
                "Payment was verified successfully and the recovery case can now be closed."
        };


        await safeAudit({

            customerId,

            eventType:
                "ACTION_DECISION",

            previousState:
                stateAfterExecution.current_state,

            newState:
                stateAfterExecution.current_state,

            intent:
                analysis.intent,

            action:
                "CLOSE_CASE",

            priority:
                "NORMAL",

            requiresHuman:
                false,

            success:
                true,

            reason:
                followUpDecision.reason
        });


        followUpExecution =
            await executeAction(

                customerId,

                followUpDecision,

                null
            );


        await safeAudit({

            customerId,

            eventType:
                "ACTION_EXECUTED",

            previousState:
                "PAID",

            newState:
                getState(customerId)
                    .current_state,

            intent:
                analysis.intent,

            action:
                "CLOSE_CASE",

            priority:
                "NORMAL",

            requiresHuman:
                false,

            success:
                Boolean(
                    followUpExecution.success
                ),

            reason:
                followUpExecution.message ||
                followUpDecision.reason,

            message:
                followUpExecution.outbound_message ||
                null
        });


        if (
            followUpExecution.success
        ) {

            await safeAudit({

                customerId,

                eventType:
                    "CASE_CLOSED",

                previousState:
                    "PAID",

                newState:
                    getState(customerId)
                        .current_state,

                intent:
                    analysis.intent,

                action:
                    "CLOSE_CASE",

                priority:
                    "NORMAL",

                requiresHuman:
                    false,

                success:
                    true,

                reason:
                    "Recovery case closed after successful payment verification.",

                message:
                    followUpExecution.message ||
                    null
            });
        }
    }


    /*
     * ========================================================
     * 15. AUDIT ESCALATION
     * ========================================================
     */

    const finalStateBeforeReturn =
        getState(customerId);


    if (
        finalStateBeforeReturn.current_state ===
        "ESCALATED"
    ) {

        await safeAudit({

            customerId,

            eventType:
                "ESCALATION",

            previousState:
                state.current_state,

            newState:
                "ESCALATED",

            intent:
                analysis.intent,

            action:
                decision.action,

            priority:
                "CRITICAL",

            requiresHuman:
                true,

            success:
                true,

            reason:
                decision.reason,

            message:
                analysis.suggested_response ||
                null,

            metadata: {

                escalation_required:
                    Boolean(
                        analysis.escalation_required
                    ),

                sentiment:
                    analysis.sentiment
            }
        });
    }


    /*
     * ========================================================
     * 16. FINAL STATE
     * ========================================================
     */

    const finalState =
        getState(customerId);


    /*
     * ========================================================
     * 17. RETURN COMPLETE RESULT
     * ========================================================
     */

    return {

        analysis,

        state:
            finalState,

        decision,

        execution,

        follow_up_decision:
            followUpDecision,

        follow_up_execution:
            followUpExecution
    };
}


module.exports = {
    processCustomerMessage
};