# Artha Setu AI

### Intelligent Receivables Recovery

Artha Setu AI is an AI-powered accounts receivable recovery platform designed to help businesses understand customer payment conversations, track payment promises, automate follow-ups, verify payments against the financial ledger, and escalate risky cases for human review.

It combines LLM-based conversation intelligence with deterministic financial logic, controlled recovery states, safety-gated automation, Gmail integration, and a complete audit trail.

> **The AI understands the conversation.  
> The ledger decides the money.  
> The safety layer decides what the AI is allowed to do.**

---

## 1. Technology Stack 
- **Backend Runtime**: Node.js (v24 / v20+)
- **Server Framework**: Express.js (v4)
- **Database**: SQLite3 (`crm_database.sqlite`) with WAL mode and foreign key integrity
- **Middleware**: CORS (enabled for all origins `*`), JSON body parser, request logging
Frontend: Responsive Single Page Application (SPA) using HTML, CSS & JavaScript

---

## 2. Database Used
- **Database Engine**: SQLite 3 (embedded file-based database at `crm_database.sqlite`)
- **Tables**:
  - `customers`: 32 realistic B2B enterprise client profiles with communication tone & language preferences.
  - `invoices`: 65 realistic invoices spanning Overdue, Pending, Partially Paid, and Paid states with aging metrics.
  - `payments`: 26+ historical payment transaction receipts linked to invoices and customers.

---

## 3. How to Run the Application

### Prerequisites:
- Node.js (v18+)

### Steps:
```bash
# 1. Navigate to the project folder:
cd "C:\Users\Toran\.gemini\antigravity\scratch\mock-ar-crm"

# 2. Install dependencies:
npm install

# 3. Start the server (auto-seeds database on first launch):
npm start
```

The web dashboard is immediately accessible at **`http://localhost:3000`**.

---

## 4. API Base URL
```
http://localhost:3000/api
```

---

## 5. REST API Endpoints Created

### Customer Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | List all customers with balances (supports `?search=`, `?tone=`, `?language=`, `?risk=high`) |
| `GET` | `/api/customers/:id` | Get single customer with full invoices & payment history |
| `POST` | `/api/customers` | Create a new customer |
| `PATCH` | `/api/customers/:id` | Update customer contact info, language, or communication tone |
| `GET` | `/api/customers/:id/invoices` | Get all invoices for a specific customer |
| `GET` | `/api/customers/:id/payments` | Get all payment history records for a customer |

### Invoice & Receivables Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/invoices` | List all invoices with filters (`?status=`, `?customer_id=`, `?sort=`, `?order=`) |
| `GET` | `/api/invoices/overdue` | **Primary endpoint for AI recovery**: Lists only overdue invoices with days overdue & customer preferences |
| `GET` | `/api/invoices/:id` | Get invoice details by ID |
| `POST` | `/api/invoices` | Create a new invoice |
| `PATCH` | `/api/invoices/:id` | Update invoice status, amount paid, or due date |
| `POST` | `/api/invoices/:id/payments` | **Record a payment**: Automatically calculates outstanding balance and updates status |

### Payments & Analytics Endpoints:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/payments` | List all payment receipts |
| `GET` | `/api/dashboard/stats` | Returns global KPIs: Total outstanding, overdue sum, paid sum, and aging breakdown |
| `POST` | `/api/seed` | Reset and re-seed the demo database with 32+ customers and 65 invoices |
| `GET` | `/api/health` | Server health check |

---

## 6. How a Separate AI Application Can Connect

Your separate AI application (e.g. Python FastAPI, LangChain, AutoGen, CrewAI, or Node.js agent) can connect directly via standard HTTP requests without authentication or CORS limitations.

### Python Example (`requests` / AI Agent Tool):
```python
import requests

BASE_URL = "http://localhost:3000/api"

# 1. Fetch overdue invoices to prioritize for recovery:
response = requests.get(f"{BASE_URL}/invoices/overdue")
overdue_invoices = response.json()["data"]

for inv in overdue_invoices:
    print(f"Invoice {inv['id']} for {inv['company_name']}:")
    print(f"  Outstanding: ${inv['amount_outstanding']} ({inv['days_overdue']} days overdue)")
    print(f"  Contact: {inv['contact_person']} ({inv['customer_email']})")
    print(f"  Preferred Language: {inv['preferred_language']}")
    print(f"  Preferred Tone: {inv['preferred_communication_tone']}")
    print(f"  Behavior Notes: {inv['payment_behavior_notes']}")

# 2. Record a simulated recovery payment once customer settles:
payment_payload = {
    "payment_amount": 14500.00,
    "payment_method": "ACH Transfer",
    "notes": "Recovered via AI Negotiation Agent"
}
pay_response = requests.post(f"{BASE_URL}/invoices/INV-2024-001/payments", json=payment_payload)
print("Payment recorded:", pay_response.json())
```

### JavaScript / TypeScript Example:
```javascript
const res = await fetch('http://localhost:3000/api/invoices/overdue');
const { data: overdueInvoices } = await res.json();
console.log('Overdue accounts to recover:', overdueInvoices);
```
