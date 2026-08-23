const { decideNextAction } = require("./action_engine");
const { getState, updateState } = require("./state_manager");

const customerId = "CUST-TEST-001";

const testStates = [
    "OVERDUE",
    "CONTACTED",
    "PROMISED_PAYMENT",
    "WAITING_FOR_PAYMENT",
    "FOLLOW_UP_DUE",
    "ESCALATED",
    "PAID",
    "CLOSED",
];

for (const state of testStates) {
    updateState(customerId, {
        current_state: state,
        promised_date: state === "PROMISED_PAYMENT" ? "TOMORROW" : null,
    });

    const customerState = getState(customerId);
    const decision = decideNextAction(customerState);

    console.log("\n--- " + state + " ---");
    console.log(decision);
}