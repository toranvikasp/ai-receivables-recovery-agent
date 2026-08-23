const {
    markContacted,
    markPromiseMade,
    markFollowUpDue,
    markEscalated,
    markPaid,
} = require("./state_transition_engine");

const customerId = "CUST-1001";

console.log("\n--- CONTACTED ---");
console.log(markContacted(customerId));

console.log("\n--- PROMISE MADE ---");
console.log(markPromiseMade(customerId, "TOMORROW"));

console.log("\n--- FOLLOW-UP DUE ---");
console.log(markFollowUpDue(customerId));

console.log("\n--- ESCALATED ---");
console.log(markEscalated(customerId));

console.log("\n--- PAYMENT RECEIVED ---");
console.log(markPaid(customerId));