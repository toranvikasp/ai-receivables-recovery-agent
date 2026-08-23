const { processCustomerMessage } = require("./recovery_agent");

async function runTest() {
    const result = await processCustomerMessage({
        customer_id: "CUST-AGENT-001",
        message: "Bhai kal pakka kar dunga.",
    });

    console.log("\n===== AI UNDERSTANDING =====");
    console.log(result.analysis);

    console.log("\n===== AGENT MEMORY =====");
    console.log(result.state);

    console.log("\n===== AGENT DECISION =====");
    console.log(result.decision);
}

runTest().catch((error) => {
    console.error("\nTEST FAILED:");
    console.error(error);
});