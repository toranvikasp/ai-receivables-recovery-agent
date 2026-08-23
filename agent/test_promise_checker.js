const {
    checkPromise,
} = require("./promise_checker");

const {
    updateState,
} = require("./state_manager");

const customerId = "CUST-TEST-001";

// Create a customer who has promised payment
updateState(customerId, {
    current_state: "PROMISED_PAYMENT",
    promised_date: "2026-08-22",
    last_message: "I will pay tomorrow.",
    last_intent: "PROMISE_TO_PAY",
    next_action: "WAITING_FOR_PAYMENT",
});

console.log("\n--- BEFORE CHECK ---");
console.log(checkPromise(customerId));

console.log("\n--- AFTER PAYMENT ---");
console.log(checkPromise(customerId, true));