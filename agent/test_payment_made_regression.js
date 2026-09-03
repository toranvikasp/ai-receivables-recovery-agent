const assert = require("assert");
const { processCustomerMessage } = require("./recovery_agent");
const { updateState, getState, STATES } = require("./state_manager");
const { markEscalated } = require("./state_transition_engine");

async function testPaymentMadeRegression() {
    console.log("🧪 Starting PAYMENT_MADE Regression Test...");

    const testCustomerId = "CUST-REGRESSION-001";

    // 1. Setup: Put high-risk customer into ESCALATED state initially
    markEscalated(testCustomerId);
    let initialState = getState(testCustomerId);
    assert.strictEqual(initialState.current_state, STATES.ESCALATED, "Initial state should be ESCALATED");
    console.log("  ✅ Initial State set to ESCALATED for high-risk account");

    // 2. Customer sends PAYMENT_MADE message
    const context = {
        customer_id: testCustomerId,
        message: "Payment released via wire #99482. Please confirm receipt.",
        customer_name: "Apex Global Logistics",
        contact_person: "Marcus Vance",
        outstanding_amount: 123500,
        days_overdue: 830,
        late_payment_count: 11
    };

    const result = await processCustomerMessage(context);

    console.log("  -> Detected Intent:", result.analysis.intent);
    console.log("  -> Updated State:", result.state.current_state);
    console.log("  -> Recommended Action:", result.decision.action);

    // 3. Assertions
    assert.strictEqual(result.analysis.intent, "PAYMENT_MADE", "AI Intent should be PAYMENT_MADE");
    
    // Must NOT remain ESCALATED
    assert.notStrictEqual(result.state.current_state, STATES.ESCALATED, "State MUST NOT remain ESCALATED");
    
    // Must NOT automatically become PAID
    assert.notStrictEqual(result.state.current_state, STATES.PAID, "State MUST NOT automatically become PAID");
    
    // MUST transition to WAITING_FOR_PAYMENT state
    assert.strictEqual(result.state.current_state, STATES.WAITING_FOR_PAYMENT, "State MUST transition to WAITING_FOR_PAYMENT");
    
    // MUST recommend VERIFY_PAYMENT_RECEIPT action
    assert.strictEqual(result.decision.action, "VERIFY_PAYMENT_RECEIPT", "Action MUST be VERIFY_PAYMENT_RECEIPT");

    console.log("  ✅ PASS: High-risk ESCALATED account successfully transitioned to WAITING_FOR_PAYMENT with VERIFY_PAYMENT_RECEIPT action!");
    console.log("🎉 PAYMENT_MADE Regression Test Passed Successfully!");
}

testPaymentMadeRegression().catch((err) => {
    console.error("❌ FAIL: PAYMENT_MADE Regression Test Failed:", err);
    process.exit(1);
});
