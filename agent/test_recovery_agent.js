const { processCustomerMessage } = require("./recovery_agent");

async function runTest() {
    const result = await processCustomerMessage({
        customer_id: "CUST-1001",
        message: "Bhai kal pakka kar dunga.",
    });

    console.log("\n===== AI ANALYSIS =====");
    console.log(result.analysis);

    console.log("\n===== AGENT MEMORY =====");
    console.log(result.state);
}

runTest().catch((error) => {
    console.error("TEST FAILED:", error);
});