const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "memory.json");

const STATES = {
    OVERDUE: "OVERDUE",
    CONTACTED: "CONTACTED",
    PROMISED_PAYMENT: "PROMISED_PAYMENT",
    WAITING_FOR_PAYMENT: "WAITING_FOR_PAYMENT",
    FOLLOW_UP_DUE: "FOLLOW_UP_DUE",
    ESCALATED: "ESCALATED",
    PAID: "PAID",
    CLOSED: "CLOSED",
};


// Load saved memory when the agent starts
function loadMemory() {
    try {
        if (!fs.existsSync(MEMORY_FILE)) {
            return {};
        }

        const content = fs.readFileSync(MEMORY_FILE, "utf8");

        if (!content.trim()) {
            return {};
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("[Memory] Failed to load memory:", error.message);
        return {};
    }
}


// Save memory to disk
function saveMemory(memory) {
    fs.writeFileSync(
        MEMORY_FILE,
        JSON.stringify(memory, null, 2),
        "utf8"
    );
}


let customerStates = loadMemory();


function createOrGetState(customerId) {
    if (!customerStates[customerId]) {
        customerStates[customerId] = {
            customer_id: customerId,
            current_state: STATES.OVERDUE,
            promised_date: null,
            last_message: null,
            last_intent: null,
            next_action: "CONTACT_CUSTOMER",
            updated_at: new Date().toISOString(),
        };

        saveMemory(customerStates);
    }

    return customerStates[customerId];
}


function updateState(customerId, updates) {
    const state = createOrGetState(customerId);

    Object.assign(state, updates, {
        updated_at: new Date().toISOString(),
    });

    saveMemory(customerStates);

    return state;
}


function recordPromise(
    customerId,
    message,
    promisedDate = "TOMORROW"
) {
    return updateState(customerId, {
        current_state: STATES.PROMISED_PAYMENT,
        promised_date: promisedDate,
        last_message: message,
        last_intent: "PROMISE_TO_PAY",
        next_action: "WAITING_FOR_PAYMENT",
    });
}


function markPaymentReceived(
    customerId,
    message = null
) {
    return updateState(customerId, {
        current_state: STATES.PAID,
        promised_date: null,
        last_message: message,
        last_intent: "PAYMENT_RECEIVED",
        next_action: "CLOSE_CASE",
    });
}


function getState(customerId) {
    return createOrGetState(customerId);
}


module.exports = {
    STATES,
    createOrGetState,
    updateState,
    recordPromise,
    markPaymentReceived,
    getState,
};