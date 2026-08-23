const { analyzeCustomerReply } = require("../ai-engine/conversation_analyzer");

const {
    recordPromise,
    markPaymentReceived,
    updateState,
} = require("./state_manager");

const {
    decideNextAction,
} = require("./action_engine");


async function processCustomerMessage(context) {
    // 1. Gemini understands the customer
    const analysisResult = await analyzeCustomerReply(context);

    const analysis = analysisResult.data;
    const customerId = context.customer_id;

    // 2. Save the latest conversation
    updateState(customerId, {
        last_message: context.message,
        last_intent: analysis.intent,
    });

    // 3. Customer promises payment
    if (analysis.intent === "PROMISE_TO_PAY") {
        recordPromise(
            customerId,
            context.message,
            analysis.promised_date || "TOMORROW"
        );
    }

    // 4. Customer has paid
    else if (
        analysis.intent === "PAYMENT_RECEIVED" ||
        analysis.intent === "PAID"
    ) {
        markPaymentReceived(
            customerId,
            context.message
        );
    }

    // 5. Get the latest state
    const { getState } = require("./state_manager");
    const state = getState(customerId);

    // 6. Decide what the agent should do next
    const decision = decideNextAction(state);

    // 7. Return everything together
    return {
        analysis,
        state,
        decision,
    };
}


module.exports = {
    processCustomerMessage,
};