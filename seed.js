const { run, exec, initializeSchema } = require('./db');

const customersData = [
  {
    "id": "CUST-1001",
    "company_name": "Apex Global Logistics Inc.",
    "contact_person": "Marcus Vance",
    "email": "m.vance@apexlogistics.com",
    "phone": "+1 (415) 555-0142",
    "preferred_language": "English",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 5,
    "payment_behavior_notes": "Requires formal statements of account. Responds quickly to direct escalation from finance leadership."
  },
  {
    "id": "CUST-1002",
    "company_name": "Solaria Clean Energy Systems",
    "contact_person": "Dr. Elena Rostova",
    "email": "e.rostova@solariapower.de",
    "phone": "+49 30 5678 9201",
    "preferred_language": "German",
    "preferred_communication_tone": "Concise & Data-Driven",
    "late_payment_count": 1,
    "payment_behavior_notes": "Very structured accounting cycle; processes invoices on the 1st and 15th of each month."
  },
  {
    "id": "CUST-1003",
    "company_name": "Meridian BioPharma Corp",
    "contact_person": "Claire Beauchamp",
    "email": "c.beauchamp@meridianbio.fr",
    "phone": "+33 1 42 68 55 00",
    "preferred_language": "French",
    "preferred_communication_tone": "Empathetic & Collaborative",
    "late_payment_count": 4,
    "payment_behavior_notes": "Appreciates collaborative check-ins before due dates. Tends to delay if PO matching discrepancies occur."
  },
  {
    "id": "CUST-1004",
    "company_name": "Vanguard Robotics LLC",
    "contact_person": "David Sterling",
    "email": "dsterling@vanguardbot.com",
    "phone": "+1 (617) 555-8392",
    "preferred_language": "English",
    "preferred_communication_tone": "Firm & Urgent",
    "late_payment_count": 8,
    "payment_behavior_notes": "Chronically deprioritizes vendor payouts unless firm payment suspension warnings are issued."
  },
  {
    "id": "CUST-1005",
    "company_name": "Novus FinTech Solutions",
    "contact_person": "Priya Sundaram",
    "email": "priya.sundaram@novusfin.in",
    "phone": "+91 80 4123 9980",
    "preferred_language": "Hindi",
    "preferred_communication_tone": "Friendly & Casual",
    "late_payment_count": 0,
    "payment_behavior_notes": "Prompt payer with impeccable credit record. Always settles within 10 days of invoice receipt."
  },
  {
    "id": "CUST-1006",
    "company_name": "Iberica Industrial Fabrics S.L.",
    "contact_person": "Carlos Mendes",
    "email": "cmendes@ibericafabrics.es",
    "phone": "+34 91 555 4321",
    "preferred_language": "Spanish",
    "preferred_communication_tone": "Empathetic & Collaborative",
    "late_payment_count": 3,
    "payment_behavior_notes": "Responsive to WhatsApp/phone reminders. Often splits larger invoices across bi-weekly installments."
  },
  {
    "id": "CUST-1007",
    "company_name": "Kyoto Precision Instruments",
    "contact_person": "Kenji Takahashi",
    "email": "k-takahashi@kyotopi.co.jp",
    "phone": "+81 3 5555 0199",
    "preferred_language": "Japanese",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 0,
    "payment_behavior_notes": "Extremely disciplined payout schedule. Follows strict Net-30 terms without exception."
  },
  {
    "id": "CUST-1008",
    "company_name": "Atlas Heavy Construction Ltd",
    "contact_person": "Robert 'Bob' Kowalski",
    "email": "bkowalski@atlasheavy.com",
    "phone": "+1 (312) 555-7281",
    "preferred_language": "English",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 7,
    "payment_behavior_notes": "Subject to seasonal cash flow constraints. Requires direct outreach to accounts payable controller."
  },
  {
    "id": "CUST-1009",
    "company_name": "Sao Paulo AgroTech S.A.",
    "contact_person": "Juliana Silveira",
    "email": "jsilveira@spagrotech.com.br",
    "phone": "+55 11 3291 8840",
    "preferred_language": "Portuguese",
    "preferred_communication_tone": "Friendly & Casual",
    "late_payment_count": 2,
    "payment_behavior_notes": "Friendly relationship; prefers soft reminders 3 days before due date to initiate bank wire."
  },
  {
    "id": "CUST-1010",
    "company_name": "Cascade Mountain Retail Group",
    "contact_person": "Timothy O'Connor",
    "email": "toconnor@cascademrg.com",
    "phone": "+1 (206) 555-9102",
    "preferred_language": "English",
    "preferred_communication_tone": "Firm & Urgent",
    "late_payment_count": 9,
    "payment_behavior_notes": "High risk profile. Requires immediate escalation upon reaching 15 days overdue to prevent 60+ day aging."
  },
  {
    "id": "CUST-1011",
    "company_name": "AeroDynamics Aerospace Ltd",
    "contact_person": "Alastair MacIntyre",
    "email": "a.macintyre@aerodynamics.co.uk",
    "phone": "+44 20 7946 0831",
    "preferred_language": "English",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 1,
    "payment_behavior_notes": "Requires milestone sign-off documentation attached to invoices before processing."
  },
  {
    "id": "CUST-1012",
    "company_name": "Lumina Digital Media Group",
    "contact_person": "Sophie Van Der Bilt",
    "email": "sophie@luminamedia.nl",
    "phone": "+31 20 890 1234",
    "preferred_language": "English",
    "preferred_communication_tone": "Friendly & Casual",
    "late_payment_count": 3,
    "payment_behavior_notes": "Fast-moving digital agency; occasionally overlooks emailed PDF invoices due to mailbox clutter."
  },
  {
    "id": "CUST-1013",
    "company_name": "Bavaria Automotive Engineering",
    "contact_person": "Klaus Weber",
    "email": "klaus.weber@bavaria-auto.de",
    "phone": "+49 89 2345 6789",
    "preferred_language": "German",
    "preferred_communication_tone": "Concise & Data-Driven",
    "late_payment_count": 0,
    "payment_behavior_notes": "Enterprise tier client. High volume, settled on time via automated SEPA direct debit."
  },
  {
    "id": "CUST-1014",
    "company_name": "Pacifica Healthcare Systems",
    "contact_person": "Monica Rodriguez",
    "email": "mrodriguez@pacifica-health.org",
    "phone": "+1 (858) 555-3341",
    "preferred_language": "Spanish",
    "preferred_communication_tone": "Empathetic & Collaborative",
    "late_payment_count": 6,
    "payment_behavior_notes": "Hospital system with slow departmental invoice approvals. Follow-up with Chief Medical Officer needed."
  },
  {
    "id": "CUST-1015",
    "company_name": "Zenith Cloud Infrastructures",
    "contact_person": "Nathaniel Drake",
    "email": "ndrake@zenithinfra.io",
    "phone": "+1 (408) 555-6677",
    "preferred_language": "English",
    "preferred_communication_tone": "Concise & Data-Driven",
    "late_payment_count": 1,
    "payment_behavior_notes": "Tech-savvy team. Prefers structured payment links and webhook notifications."
  },
  {
    "id": "CUST-1016",
    "company_name": "Nordic Timber & Pulp AB",
    "contact_person": "Astrid Lindgren-Holm",
    "email": "astrid.holm@nordictimber.se",
    "phone": "+46 8 123 4567",
    "preferred_language": "English",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 2,
    "payment_behavior_notes": "Processes international wires on the 20th of every month."
  },
  {
    "id": "CUST-1017",
    "company_name": "Hindustan Logistics Hub",
    "contact_person": "Vikram Malhotra",
    "email": "vikram.m@hindustanlogistics.in",
    "phone": "+91 22 2490 8871",
    "preferred_language": "Hindi",
    "preferred_communication_tone": "Empathetic & Collaborative",
    "late_payment_count": 4,
    "payment_behavior_notes": "Prefers discussing cash allocation plans directly over call before releasing RTGS funds."
  },
  {
    "id": "CUST-1018",
    "company_name": "Rio Verde Beverage Bottlers",
    "contact_person": "Rodrigo Fonseca",
    "email": "rfonseca@rioverdebottlers.com",
    "phone": "+55 21 3498 7700",
    "preferred_language": "Portuguese",
    "preferred_communication_tone": "Friendly & Casual",
    "late_payment_count": 5,
    "payment_behavior_notes": "Distributor payment delays cascade into late vendor payments. Negotiates payment schedules frequently."
  },
  {
    "id": "CUST-1019",
    "company_name": "Silverline Catering & Events",
    "contact_person": "Hannah Abbott",
    "email": "hannah@silverlineevents.com",
    "phone": "+1 (303) 555-4421",
    "preferred_language": "English",
    "preferred_communication_tone": "Friendly & Casual",
    "late_payment_count": 2,
    "payment_behavior_notes": "Settles immediately upon completion of major event billing cycles."
  },
  {
    "id": "CUST-1020",
    "company_name": "Tokyo Robotics & AI Labs",
    "contact_person": "Hanae Mori",
    "email": "h-mori@tokyorobotics.jp",
    "phone": "+81 3 4567 8901",
    "preferred_language": "Japanese",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 0,
    "payment_behavior_notes": "Exact matching of purchase order items required. Never pays late once PO is matched."
  },
  {
    "id": "CUST-1021",
    "company_name": "Catalunya Chemical Works",
    "contact_person": "Jordi Pujol-Sola",
    "email": "jpujol@catalunyachem.cat",
    "phone": "+34 93 456 7890",
    "preferred_language": "Spanish",
    "preferred_communication_tone": "Firm & Urgent",
    "late_payment_count": 6,
    "payment_behavior_notes": "Requires formal demand letters when invoices exceed 30 days overdue."
  },
  {
    "id": "CUST-1022",
    "company_name": "Great Lakes Foundry Corp",
    "contact_person": "Arthur Pendelton",
    "email": "apendelton@glfoundry.com",
    "phone": "+1 (216) 555-9081",
    "preferred_language": "English",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 11,
    "payment_behavior_notes": "Severe late payment history. Subject to credit hold if overdue exceeds $15,000."
  },
  {
    "id": "CUST-1023",
    "company_name": "Alpine Resort Management AG",
    "contact_person": "Beatrix Zurbriggen",
    "email": "b.zurbriggen@alpineresorts.ch",
    "phone": "+41 22 789 0123",
    "preferred_language": "German",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 1,
    "payment_behavior_notes": "Seasonal high volume in Q1 and Q4; steady payout track record."
  },
  {
    "id": "CUST-1024",
    "company_name": "Lyon Gourmet Distribution",
    "contact_person": "Sebastien Moreau",
    "email": "smoreau@lyongourmet.fr",
    "phone": "+33 4 78 90 12 34",
    "preferred_language": "French",
    "preferred_communication_tone": "Empathetic & Collaborative",
    "late_payment_count": 3,
    "payment_behavior_notes": "Responsive when approached in French with polite reminder letters."
  },
  {
    "id": "CUST-1025",
    "company_name": "CyberShield Security Group",
    "contact_person": "Evelyn Chen",
    "email": "echen@cybershield.io",
    "phone": "+1 (512) 555-4890",
    "preferred_language": "English",
    "preferred_communication_tone": "Concise & Data-Driven",
    "late_payment_count": 0,
    "payment_behavior_notes": "Direct ACH on the 10th of every month. Excellent financial health."
  },
  {
    "id": "CUST-1026",
    "company_name": "Andes Mining & Minerals Corp",
    "contact_person": "Mateo Morales",
    "email": "mmorales@andesminerals.cl",
    "phone": "+56 2 2345 6789",
    "preferred_language": "Spanish",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 7,
    "payment_behavior_notes": "Complex approval chain involving engineering sign-offs. Delays expected unless prompted weekly."
  },
  {
    "id": "CUST-1027",
    "company_name": "OmniCorp Facilities Ltd",
    "contact_person": "Darren Fletcher",
    "email": "dfletcher@omnicorpfacilities.co.uk",
    "phone": "+44 161 890 1234",
    "preferred_language": "English",
    "preferred_communication_tone": "Firm & Urgent",
    "late_payment_count": 5,
    "payment_behavior_notes": "Requires strict invoice escalation to Managing Director to secure release."
  },
  {
    "id": "CUST-1028",
    "company_name": "Bharat Telecommunications Ltd",
    "contact_person": "Ananya Iyer",
    "email": "ananya.iyer@bharattel.com",
    "phone": "+91 11 4321 0987",
    "preferred_language": "Hindi",
    "preferred_communication_tone": "Concise & Data-Driven",
    "late_payment_count": 2,
    "payment_behavior_notes": "Requires GST invoice verification before passing to treasury disbursement."
  },
  {
    "id": "CUST-1029",
    "company_name": "Helvetia Packaging Solutions",
    "contact_person": "Ursula Baumgartner",
    "email": "ubaumgartner@helvetiapack.ch",
    "phone": "+41 44 890 5678",
    "preferred_language": "German",
    "preferred_communication_tone": "Concise & Data-Driven",
    "late_payment_count": 0,
    "payment_behavior_notes": "Zero late payments in 3 years. Gold standard customer."
  },
  {
    "id": "CUST-1030",
    "company_name": "Starlight Digital Entertainment",
    "contact_person": "Liam Gallagher",
    "email": "lgallagher@starlightent.com",
    "phone": "+1 (310) 555-7788",
    "preferred_language": "English",
    "preferred_communication_tone": "Friendly & Casual",
    "late_payment_count": 4,
    "payment_behavior_notes": "Entertainment production timelines cause sporadic payment batching."
  },
  {
    "id": "CUST-1031",
    "company_name": "Kyushu Marine Shipping",
    "contact_person": "Daiki Sato",
    "email": "d-sato@kyushumarine.jp",
    "phone": "+81 92 456 7890",
    "preferred_language": "Japanese",
    "preferred_communication_tone": "Formal & Direct",
    "late_payment_count": 1,
    "payment_behavior_notes": "Payment released upon customs clearance milestone completion."
  },
  {
    "id": "CUST-1032",
    "company_name": "Valencia Ceramic Tile Co",
    "contact_person": "Isabel Garcia-Navarro",
    "email": "igarcia@valenciaceramics.es",
    "phone": "+34 96 123 4567",
    "preferred_language": "Spanish",
    "preferred_communication_tone": "Empathetic & Collaborative",
    "late_payment_count": 5,
    "payment_behavior_notes": "Family-owned business. Very courteous and appreciates personalized payment reminder emails in Spanish."
  }
];
const invoicesData = [
  {
    "id": "INV-2024-001",
    "customer_id": "CUST-1001",
    "invoice_amount": 14500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 14500.0,
    "issue_date": "2024-06-01",
    "due_date": "2024-07-01",
    "payment_status": "OVERDUE",
    "description": "Enterprise Fleet Telematics & GPS Integration Q2"
  },
  {
    "id": "INV-2024-002",
    "customer_id": "CUST-1001",
    "invoice_amount": 8200.0,
    "amount_paid": 4000.0,
    "amount_outstanding": 4200.0,
    "issue_date": "2024-06-15",
    "due_date": "2024-07-15",
    "payment_status": "PARTIALLY_PAID",
    "description": "Custom Route Optimization API Annual License"
  },
  {
    "id": "INV-2024-003",
    "customer_id": "CUST-1001",
    "invoice_amount": 12000.0,
    "amount_paid": 12000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-04-01",
    "due_date": "2024-05-01",
    "payment_status": "PAID",
    "description": "Warehouse Sensor Hardware Deployment"
  },
  {
    "id": "INV-2024-004",
    "customer_id": "CUST-1002",
    "invoice_amount": 28400.0,
    "amount_paid": 0.0,
    "amount_outstanding": 28400.0,
    "issue_date": "2024-07-10",
    "due_date": "2024-08-10",
    "payment_status": "OVERDUE",
    "description": "Solar Farm SCADA Supervisory Software License"
  },
  {
    "id": "INV-2024-005",
    "customer_id": "CUST-1002",
    "invoice_amount": 19500.0,
    "amount_paid": 19500.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-05",
    "due_date": "2024-06-05",
    "payment_status": "PAID",
    "description": "Battery Storage Efficiency Analytics Setup"
  },
  {
    "id": "INV-2024-006",
    "customer_id": "CUST-1003",
    "invoice_amount": 34000.0,
    "amount_paid": 10000.0,
    "amount_outstanding": 24000.0,
    "issue_date": "2024-06-20",
    "due_date": "2024-07-20",
    "payment_status": "PARTIALLY_PAID",
    "description": "Clinical Trial Data Pipeline Implementation"
  },
  {
    "id": "INV-2024-007",
    "customer_id": "CUST-1003",
    "invoice_amount": 15600.0,
    "amount_paid": 0.0,
    "amount_outstanding": 15600.0,
    "issue_date": "2024-07-25",
    "due_date": "2024-08-25",
    "payment_status": "PENDING",
    "description": "Laboratory Compliance Audit & SaaS Access"
  },
  {
    "id": "INV-2024-008",
    "customer_id": "CUST-1004",
    "invoice_amount": 45000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 45000.0,
    "issue_date": "2024-05-01",
    "due_date": "2024-06-01",
    "payment_status": "OVERDUE",
    "description": "Industrial Robotics Vision AI Module"
  },
  {
    "id": "INV-2024-009",
    "customer_id": "CUST-1004",
    "invoice_amount": 22500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 22500.0,
    "issue_date": "2024-06-10",
    "due_date": "2024-07-10",
    "payment_status": "OVERDUE",
    "description": "Firmware Maintenance Contract Tier 1"
  },
  {
    "id": "INV-2024-010",
    "customer_id": "CUST-1005",
    "invoice_amount": 18750.0,
    "amount_paid": 18750.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-15",
    "due_date": "2024-07-15",
    "payment_status": "PAID",
    "description": "High-Frequency Transaction Gateway Upgrade"
  },
  {
    "id": "INV-2024-011",
    "customer_id": "CUST-1005",
    "invoice_amount": 12500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 12500.0,
    "issue_date": "2024-08-01",
    "due_date": "2024-08-31",
    "payment_status": "PENDING",
    "description": "Fraud Detection Rules Engine Subscription"
  },
  {
    "id": "INV-2024-012",
    "customer_id": "CUST-1006",
    "invoice_amount": 9800.0,
    "amount_paid": 4900.0,
    "amount_outstanding": 4900.0,
    "issue_date": "2024-06-18",
    "due_date": "2024-07-18",
    "payment_status": "PARTIALLY_PAID",
    "description": "Weaving Automation PLC Integration"
  },
  {
    "id": "INV-2024-013",
    "customer_id": "CUST-1006",
    "invoice_amount": 6200.0,
    "amount_paid": 0.0,
    "amount_outstanding": 6200.0,
    "issue_date": "2024-07-05",
    "due_date": "2024-08-05",
    "payment_status": "OVERDUE",
    "description": "Raw Material Quality Inspection Cameras"
  },
  {
    "id": "INV-2024-014",
    "customer_id": "CUST-1007",
    "invoice_amount": 31000.0,
    "amount_paid": 31000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-01",
    "due_date": "2024-07-01",
    "payment_status": "PAID",
    "description": "Laser Calibration Optics Cloud Sync"
  },
  {
    "id": "INV-2024-015",
    "customer_id": "CUST-1007",
    "invoice_amount": 14200.0,
    "amount_paid": 0.0,
    "amount_outstanding": 14200.0,
    "issue_date": "2024-08-05",
    "due_date": "2024-09-05",
    "payment_status": "PENDING",
    "description": "Nanotech Metrology Software Support"
  },
  {
    "id": "INV-2024-016",
    "customer_id": "CUST-1008",
    "invoice_amount": 52000.0,
    "amount_paid": 12000.0,
    "amount_outstanding": 40000.0,
    "issue_date": "2024-05-15",
    "due_date": "2024-06-15",
    "payment_status": "OVERDUE",
    "description": "Excavation Telemetry & Fleet Dispatch System"
  },
  {
    "id": "INV-2024-017",
    "customer_id": "CUST-1008",
    "invoice_amount": 18000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 18000.0,
    "issue_date": "2024-06-25",
    "due_date": "2024-07-25",
    "payment_status": "OVERDUE",
    "description": "Civil Works Safety Monitoring Sensors"
  },
  {
    "id": "INV-2024-018",
    "customer_id": "CUST-1009",
    "invoice_amount": 16800.0,
    "amount_paid": 0.0,
    "amount_outstanding": 16800.0,
    "issue_date": "2024-07-12",
    "due_date": "2024-08-12",
    "payment_status": "OVERDUE",
    "description": "Satellite Crop Health & Irrigation Dashboard"
  },
  {
    "id": "INV-2024-019",
    "customer_id": "CUST-1009",
    "invoice_amount": 11500.0,
    "amount_paid": 11500.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-04-10",
    "due_date": "2024-05-10",
    "payment_status": "PAID",
    "description": "Drone Imagery Analysis Platform Setup"
  },
  {
    "id": "INV-2024-020",
    "customer_id": "CUST-1010",
    "invoice_amount": 38900.0,
    "amount_paid": 0.0,
    "amount_outstanding": 38900.0,
    "issue_date": "2024-04-20",
    "due_date": "2024-05-20",
    "payment_status": "OVERDUE",
    "description": "Omnichannel POS Cloud Migration Phase 2"
  },
  {
    "id": "INV-2024-021",
    "customer_id": "CUST-1010",
    "invoice_amount": 27500.0,
    "amount_paid": 5000.0,
    "amount_outstanding": 22500.0,
    "issue_date": "2024-05-28",
    "due_date": "2024-06-28",
    "payment_status": "OVERDUE",
    "description": "Inventory Forecasting & Replenishment AI Suite"
  },
  {
    "id": "INV-2024-022",
    "customer_id": "CUST-1011",
    "invoice_amount": 64000.0,
    "amount_paid": 64000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-10",
    "due_date": "2024-06-10",
    "payment_status": "PAID",
    "description": "Avionics Stress Testing Simulator Integration"
  },
  {
    "id": "INV-2024-023",
    "customer_id": "CUST-1011",
    "invoice_amount": 21000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 21000.0,
    "issue_date": "2024-07-28",
    "due_date": "2024-08-28",
    "payment_status": "PENDING",
    "description": "Wind Tunnel Telemetry Processing Module"
  },
  {
    "id": "INV-2024-024",
    "customer_id": "CUST-1012",
    "invoice_amount": 15400.0,
    "amount_paid": 0.0,
    "amount_outstanding": 15400.0,
    "issue_date": "2024-06-22",
    "due_date": "2024-07-22",
    "payment_status": "OVERDUE",
    "description": "Video Rendering GPU Cloud Infrastructure"
  },
  {
    "id": "INV-2024-025",
    "customer_id": "CUST-1012",
    "invoice_amount": 8600.0,
    "amount_paid": 8600.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-01",
    "due_date": "2024-06-01",
    "payment_status": "PAID",
    "description": "Content Distribution CDN Accelerator"
  },
  {
    "id": "INV-2024-026",
    "customer_id": "CUST-1013",
    "invoice_amount": 72000.0,
    "amount_paid": 72000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-10",
    "due_date": "2024-07-10",
    "payment_status": "PAID",
    "description": "EV Powertrain Diagnostic Software Suite"
  },
  {
    "id": "INV-2024-027",
    "customer_id": "CUST-1013",
    "invoice_amount": 48000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 48000.0,
    "issue_date": "2024-08-01",
    "due_date": "2024-08-31",
    "payment_status": "PENDING",
    "description": "Autonomous Drive Sensor Pipeline Deployment"
  },
  {
    "id": "INV-2024-028",
    "customer_id": "CUST-1014",
    "invoice_amount": 32000.0,
    "amount_paid": 10000.0,
    "amount_outstanding": 22000.0,
    "issue_date": "2024-06-05",
    "due_date": "2024-07-05",
    "payment_status": "OVERDUE",
    "description": "EMR Interoperability & HL7 FHIR Bridge"
  },
  {
    "id": "INV-2024-029",
    "customer_id": "CUST-1014",
    "invoice_amount": 14500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 14500.0,
    "issue_date": "2024-07-15",
    "due_date": "2024-08-15",
    "payment_status": "OVERDUE",
    "description": "Patient Portal Security & MFA Infrastructure"
  },
  {
    "id": "INV-2024-030",
    "customer_id": "CUST-1015",
    "invoice_amount": 16500.0,
    "amount_paid": 16500.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-12",
    "due_date": "2024-07-12",
    "payment_status": "PAID",
    "description": "Kubernetes Cluster Observability Suite"
  },
  {
    "id": "INV-2024-031",
    "customer_id": "CUST-1015",
    "invoice_amount": 11200.0,
    "amount_paid": 0.0,
    "amount_outstanding": 11200.0,
    "issue_date": "2024-08-10",
    "due_date": "2024-09-10",
    "payment_status": "PENDING",
    "description": "Multi-Region Cloud Backup Service"
  },
  {
    "id": "INV-2024-032",
    "customer_id": "CUST-1016",
    "invoice_amount": 21500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 21500.0,
    "issue_date": "2024-07-02",
    "due_date": "2024-08-02",
    "payment_status": "OVERDUE",
    "description": "Forestry Supply Chain Traceability System"
  },
  {
    "id": "INV-2024-033",
    "customer_id": "CUST-1017",
    "invoice_amount": 17800.0,
    "amount_paid": 8900.0,
    "amount_outstanding": 8900.0,
    "issue_date": "2024-06-25",
    "due_date": "2024-07-25",
    "payment_status": "PARTIALLY_PAID",
    "description": "Container Freight Station Yard Management System"
  },
  {
    "id": "INV-2024-034",
    "customer_id": "CUST-1017",
    "invoice_amount": 9400.0,
    "amount_paid": 0.0,
    "amount_outstanding": 9400.0,
    "issue_date": "2024-07-30",
    "due_date": "2024-08-30",
    "payment_status": "PENDING",
    "description": "Cross-Docking Automated Dispatch Scanner"
  },
  {
    "id": "INV-2024-035",
    "customer_id": "CUST-1018",
    "invoice_amount": 23600.0,
    "amount_paid": 0.0,
    "amount_outstanding": 23600.0,
    "issue_date": "2024-06-14",
    "due_date": "2024-07-14",
    "payment_status": "OVERDUE",
    "description": "Bottling Plant Conveyor IoT Monitoring"
  },
  {
    "id": "INV-2024-036",
    "customer_id": "CUST-1019",
    "invoice_amount": 7800.0,
    "amount_paid": 7800.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-18",
    "due_date": "2024-06-18",
    "payment_status": "PAID",
    "description": "Banquet Scheduling & Event CRM Portal"
  },
  {
    "id": "INV-2024-037",
    "customer_id": "CUST-1019",
    "invoice_amount": 4500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 4500.0,
    "issue_date": "2024-08-05",
    "due_date": "2024-09-05",
    "payment_status": "PENDING",
    "description": "Mobile Kitchen Inventory App Subscriptions"
  },
  {
    "id": "INV-2024-038",
    "customer_id": "CUST-1020",
    "invoice_amount": 42000.0,
    "amount_paid": 42000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-05",
    "due_date": "2024-07-05",
    "payment_status": "PAID",
    "description": "Cobot Motion Planning SDK Enterprise License"
  },
  {
    "id": "INV-2024-039",
    "customer_id": "CUST-1021",
    "invoice_amount": 36500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 36500.0,
    "issue_date": "2024-05-20",
    "due_date": "2024-06-20",
    "payment_status": "OVERDUE",
    "description": "Chemical Batch Reactor Optimization Model"
  },
  {
    "id": "INV-2024-040",
    "customer_id": "CUST-1021",
    "invoice_amount": 18200.0,
    "amount_paid": 0.0,
    "amount_outstanding": 18200.0,
    "issue_date": "2024-06-25",
    "due_date": "2024-07-25",
    "payment_status": "OVERDUE",
    "description": "Hazardous Materials Environmental Sensor Array"
  },
  {
    "id": "INV-2024-041",
    "customer_id": "CUST-1022",
    "invoice_amount": 58000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 58000.0,
    "issue_date": "2024-04-15",
    "due_date": "2024-05-15",
    "payment_status": "OVERDUE",
    "description": "Smelting Furnace Predictive Maintenance AI"
  },
  {
    "id": "INV-2024-042",
    "customer_id": "CUST-1022",
    "invoice_amount": 24500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 24500.0,
    "issue_date": "2024-05-20",
    "due_date": "2024-06-20",
    "payment_status": "OVERDUE",
    "description": "Metallurgical Lab Quality Assurance Software"
  },
  {
    "id": "INV-2024-043",
    "customer_id": "CUST-1023",
    "invoice_amount": 29800.0,
    "amount_paid": 29800.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-30",
    "due_date": "2024-06-30",
    "payment_status": "PAID",
    "description": "Ski Lift RFID Access & Smart Ticketing Gateway"
  },
  {
    "id": "INV-2024-044",
    "customer_id": "CUST-1023",
    "invoice_amount": 13400.0,
    "amount_paid": 0.0,
    "amount_outstanding": 13400.0,
    "issue_date": "2024-08-02",
    "due_date": "2024-09-02",
    "payment_status": "PENDING",
    "description": "Winter Season Booking Engine Enhancement"
  },
  {
    "id": "INV-2024-045",
    "customer_id": "CUST-1024",
    "invoice_amount": 14200.0,
    "amount_paid": 7000.0,
    "amount_outstanding": 7200.0,
    "issue_date": "2024-06-15",
    "due_date": "2024-07-15",
    "payment_status": "PARTIALLY_PAID",
    "description": "Cold Chain Temperature Logging Device System"
  },
  {
    "id": "INV-2024-046",
    "customer_id": "CUST-1025",
    "invoice_amount": 38000.0,
    "amount_paid": 38000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-01",
    "due_date": "2024-07-01",
    "payment_status": "PAID",
    "description": "SOC 2 Type II Automated Compliance Auditor"
  },
  {
    "id": "INV-2024-047",
    "customer_id": "CUST-1025",
    "invoice_amount": 19000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 19000.0,
    "issue_date": "2024-08-08",
    "due_date": "2024-09-08",
    "payment_status": "PENDING",
    "description": "Threat Intelligence Feed Integration"
  },
  {
    "id": "INV-2024-048",
    "customer_id": "CUST-1026",
    "invoice_amount": 67000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 67000.0,
    "issue_date": "2024-05-10",
    "due_date": "2024-06-10",
    "payment_status": "OVERDUE",
    "description": "Open-Pit Mine Geotechnical Radar Software"
  },
  {
    "id": "INV-2024-049",
    "customer_id": "CUST-1026",
    "invoice_amount": 31000.0,
    "amount_paid": 10000.0,
    "amount_outstanding": 21000.0,
    "issue_date": "2024-06-20",
    "due_date": "2024-07-20",
    "payment_status": "PARTIALLY_PAID",
    "description": "Heavy Haulage Truck Driver Fatigue Cameras"
  },
  {
    "id": "INV-2024-050",
    "customer_id": "CUST-1027",
    "invoice_amount": 22000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 22000.0,
    "issue_date": "2024-06-08",
    "due_date": "2024-07-08",
    "payment_status": "OVERDUE",
    "description": "HVAC Energy Efficiency Optimization Suite"
  },
  {
    "id": "INV-2024-051",
    "customer_id": "CUST-1028",
    "invoice_amount": 45000.0,
    "amount_paid": 45000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-20",
    "due_date": "2024-06-20",
    "payment_status": "PAID",
    "description": "5G Tower Network Slicing Analytics"
  },
  {
    "id": "INV-2024-052",
    "customer_id": "CUST-1028",
    "invoice_amount": 28000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 28000.0,
    "issue_date": "2024-07-28",
    "due_date": "2024-08-28",
    "payment_status": "PENDING",
    "description": "Fiber Optic Line Degradation Early Warning"
  },
  {
    "id": "INV-2024-053",
    "customer_id": "CUST-1029",
    "invoice_amount": 24000.0,
    "amount_paid": 24000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-06-18",
    "due_date": "2024-07-18",
    "payment_status": "PAID",
    "description": "Biodegradable Carton Die-Cutting Software"
  },
  {
    "id": "INV-2024-054",
    "customer_id": "CUST-1030",
    "invoice_amount": 19800.0,
    "amount_paid": 0.0,
    "amount_outstanding": 19800.0,
    "issue_date": "2024-06-28",
    "due_date": "2024-07-28",
    "payment_status": "OVERDUE",
    "description": "Interactive Metaverse Unreal Engine Plugin"
  },
  {
    "id": "INV-2024-055",
    "customer_id": "CUST-1031",
    "invoice_amount": 51000.0,
    "amount_paid": 51000.0,
    "amount_outstanding": 0.0,
    "issue_date": "2024-05-15",
    "due_date": "2024-06-15",
    "payment_status": "PAID",
    "description": "Container Cargo Weight Balance & Trim Planner"
  },
  {
    "id": "INV-2024-056",
    "customer_id": "CUST-1031",
    "invoice_amount": 33000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 33000.0,
    "issue_date": "2024-08-01",
    "due_date": "2024-09-01",
    "payment_status": "PENDING",
    "description": "Ocean Route Weather Optimization AI License"
  },
  {
    "id": "INV-2024-057",
    "customer_id": "CUST-1032",
    "invoice_amount": 16400.0,
    "amount_paid": 6400.0,
    "amount_outstanding": 10000.0,
    "issue_date": "2024-06-10",
    "due_date": "2024-07-10",
    "payment_status": "PARTIALLY_PAID",
    "description": "Kiln Energy Recovery System Firmware"
  },
  {
    "id": "INV-2024-058",
    "customer_id": "CUST-1032",
    "invoice_amount": 8900.0,
    "amount_paid": 0.0,
    "amount_outstanding": 8900.0,
    "issue_date": "2024-07-01",
    "due_date": "2024-08-01",
    "payment_status": "OVERDUE",
    "description": "Ceramic Glaze Color Consistency Spectrometer"
  },
  {
    "id": "INV-2024-059",
    "customer_id": "CUST-1004",
    "invoice_amount": 17500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 17500.0,
    "issue_date": "2024-07-01",
    "due_date": "2024-08-01",
    "payment_status": "OVERDUE",
    "description": "Emergency On-site Robotic Arm Calibrations"
  },
  {
    "id": "INV-2024-060",
    "customer_id": "CUST-1008",
    "invoice_amount": 31500.0,
    "amount_paid": 0.0,
    "amount_outstanding": 31500.0,
    "issue_date": "2024-07-15",
    "due_date": "2024-08-15",
    "payment_status": "OVERDUE",
    "description": "Hydraulic Crane Load Cell Sensors & Telemetry"
  },
  {
    "id": "INV-2024-061",
    "customer_id": "CUST-1010",
    "invoice_amount": 14800.0,
    "amount_paid": 0.0,
    "amount_outstanding": 14800.0,
    "issue_date": "2024-07-18",
    "due_date": "2024-08-18",
    "payment_status": "OVERDUE",
    "description": "Store Traffic Heatmap Computer Vision Add-on"
  },
  {
    "id": "INV-2024-062",
    "customer_id": "CUST-1014",
    "invoice_amount": 26000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 26000.0,
    "issue_date": "2024-07-20",
    "due_date": "2024-08-20",
    "payment_status": "OVERDUE",
    "description": "Telehealth Video Bridge Enterprise Gateway"
  },
  {
    "id": "INV-2024-063",
    "customer_id": "CUST-1022",
    "invoice_amount": 41000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 41000.0,
    "issue_date": "2024-06-30",
    "due_date": "2024-07-30",
    "payment_status": "OVERDUE",
    "description": "Scrap Metal Sorting AI Computer Vision Cameras"
  },
  {
    "id": "INV-2024-064",
    "customer_id": "CUST-1026",
    "invoice_amount": 48000.0,
    "amount_paid": 0.0,
    "amount_outstanding": 48000.0,
    "issue_date": "2024-07-05",
    "due_date": "2024-08-05",
    "payment_status": "OVERDUE",
    "description": "Tailings Dam Water Infiltration Sensor Cloud"
  },
  {
    "id": "INV-2024-065",
    "customer_id": "CUST-1027",
    "invoice_amount": 15700.0,
    "amount_paid": 0.0,
    "amount_outstanding": 15700.0,
    "issue_date": "2024-07-12",
    "due_date": "2024-08-12",
    "payment_status": "OVERDUE",
    "description": "Smart Building Lighting Automation Controller"
  }
];
const paymentsData = [
  {
    "id": "PAY-1001",
    "invoice_id": "INV-2024-003",
    "customer_id": "CUST-1001",
    "payment_amount": 12000.0,
    "payment_date": "2024-04-28",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Settled via monthly ACH batch."
  },
  {
    "id": "PAY-1002",
    "invoice_id": "INV-2024-002",
    "customer_id": "CUST-1001",
    "payment_amount": 4000.0,
    "payment_date": "2024-07-14",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Partial installment 1 of 2."
  },
  {
    "id": "PAY-1003",
    "invoice_id": "INV-2024-005",
    "customer_id": "CUST-1002",
    "payment_amount": 19500.0,
    "payment_date": "2024-06-03",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "SEPA corporate transfer received."
  },
  {
    "id": "PAY-1004",
    "invoice_id": "INV-2024-006",
    "customer_id": "CUST-1003",
    "payment_amount": 10000.0,
    "payment_date": "2024-07-18",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Advance installment approved by finance."
  },
  {
    "id": "PAY-1005",
    "invoice_id": "INV-2024-010",
    "customer_id": "CUST-1005",
    "payment_amount": 18750.0,
    "payment_date": "2024-07-10",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Paid 5 days before due date."
  },
  {
    "id": "PAY-1006",
    "invoice_id": "INV-2024-012",
    "customer_id": "CUST-1006",
    "payment_amount": 4900.0,
    "payment_date": "2024-07-15",
    "payment_status": "COMPLETED",
    "payment_method": "Credit Card",
    "notes": "Corporate Visa payment."
  },
  {
    "id": "PAY-1007",
    "invoice_id": "INV-2024-014",
    "customer_id": "CUST-1007",
    "payment_amount": 31000.0,
    "payment_date": "2024-06-28",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "SWIFT international bank transfer."
  },
  {
    "id": "PAY-1008",
    "invoice_id": "INV-2024-016",
    "customer_id": "CUST-1008",
    "payment_amount": 12000.0,
    "payment_date": "2024-06-10",
    "payment_status": "COMPLETED",
    "payment_method": "Check",
    "notes": "Paper check #4491 cleared."
  },
  {
    "id": "PAY-1009",
    "invoice_id": "INV-2024-019",
    "customer_id": "CUST-1009",
    "payment_amount": 11500.0,
    "payment_date": "2024-05-08",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Banco do Brasil international wire."
  },
  {
    "id": "PAY-1010",
    "invoice_id": "INV-2024-021",
    "customer_id": "CUST-1010",
    "payment_amount": 5000.0,
    "payment_date": "2024-06-25",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Initial partial payment."
  },
  {
    "id": "PAY-1011",
    "invoice_id": "INV-2024-022",
    "customer_id": "CUST-1011",
    "payment_amount": 64000.0,
    "payment_date": "2024-06-08",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "BACS direct wire settlement."
  },
  {
    "id": "PAY-1012",
    "invoice_id": "INV-2024-025",
    "customer_id": "CUST-1012",
    "payment_amount": 8600.0,
    "payment_date": "2024-05-29",
    "payment_status": "COMPLETED",
    "payment_method": "Credit Card",
    "notes": "Corporate Mastercard."
  },
  {
    "id": "PAY-1013",
    "invoice_id": "INV-2024-026",
    "customer_id": "CUST-1013",
    "payment_amount": 72000.0,
    "payment_date": "2024-07-08",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Deutsche Bank automated settlement."
  },
  {
    "id": "PAY-1014",
    "invoice_id": "INV-2024-028",
    "customer_id": "CUST-1014",
    "payment_amount": 10000.0,
    "payment_date": "2024-07-02",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Healthcare vendor billing approval tranche 1."
  },
  {
    "id": "PAY-1015",
    "invoice_id": "INV-2024-030",
    "customer_id": "CUST-1015",
    "payment_amount": 16500.0,
    "payment_date": "2024-07-10",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Standard recurring vendor payout."
  },
  {
    "id": "PAY-1016",
    "invoice_id": "INV-2024-033",
    "customer_id": "CUST-1017",
    "payment_amount": 8900.0,
    "payment_date": "2024-07-22",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "HDFC bank RTGS transfer."
  },
  {
    "id": "PAY-1017",
    "invoice_id": "INV-2024-036",
    "customer_id": "CUST-1019",
    "payment_amount": 7800.0,
    "payment_date": "2024-06-15",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Post-event settlement."
  },
  {
    "id": "PAY-1018",
    "invoice_id": "INV-2024-038",
    "customer_id": "CUST-1020",
    "payment_amount": 42000.0,
    "payment_date": "2024-07-03",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Bank of Tokyo-Mitsubishi wire transfer."
  },
  {
    "id": "PAY-1019",
    "invoice_id": "INV-2024-043",
    "customer_id": "CUST-1023",
    "payment_amount": 29800.0,
    "payment_date": "2024-06-26",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "UBS Zurich wire transfer."
  },
  {
    "id": "PAY-1020",
    "invoice_id": "INV-2024-045",
    "customer_id": "CUST-1024",
    "payment_amount": 7000.0,
    "payment_date": "2024-07-10",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Partial payment installment."
  },
  {
    "id": "PAY-1021",
    "invoice_id": "INV-2024-046",
    "customer_id": "CUST-1025",
    "payment_amount": 38000.0,
    "payment_date": "2024-06-28",
    "payment_status": "COMPLETED",
    "payment_method": "ACH Transfer",
    "notes": "Direct automated deposit."
  },
  {
    "id": "PAY-1022",
    "invoice_id": "INV-2024-049",
    "customer_id": "CUST-1026",
    "payment_amount": 10000.0,
    "payment_date": "2024-07-15",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Banco de Chile telegraphic transfer."
  },
  {
    "id": "PAY-1023",
    "invoice_id": "INV-2024-051",
    "customer_id": "CUST-1028",
    "payment_amount": 45000.0,
    "payment_date": "2024-06-18",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "State Bank of India NEFT payment."
  },
  {
    "id": "PAY-1024",
    "invoice_id": "INV-2024-053",
    "customer_id": "CUST-1029",
    "payment_amount": 24000.0,
    "payment_date": "2024-07-14",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Credit Suisse SEPA transfer."
  },
  {
    "id": "PAY-1025",
    "invoice_id": "INV-2024-055",
    "customer_id": "CUST-1031",
    "payment_amount": 51000.0,
    "payment_date": "2024-06-12",
    "payment_status": "COMPLETED",
    "payment_method": "Wire Transfer",
    "notes": "Sumitomo Mitsui Banking Corp transfer."
  },
  {
    "id": "PAY-1026",
    "invoice_id": "INV-2024-057",
    "customer_id": "CUST-1032",
    "payment_amount": 6400.0,
    "payment_date": "2024-07-08",
    "payment_status": "COMPLETED",
    "payment_method": "Credit Card",
    "notes": "Santander Corporate Card installment."
  }
];

async function seedDatabase() {
  console.log('Seeding database with realistic B2B AR data...');
  await initializeSchema();

  await exec('DELETE FROM payments; DELETE FROM invoices; DELETE FROM customers;');

  for (const c of customersData) {
    await run(`
      INSERT INTO customers (id, company_name, contact_person, email, phone, preferred_language, preferred_communication_tone, late_payment_count, payment_behavior_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [c.id, c.company_name, c.contact_person, c.email, c.phone, c.preferred_language, c.preferred_communication_tone, c.late_payment_count, c.payment_behavior_notes]);
  }
  console.log('Inserted ' + customersData.length + ' B2B customers.');

  for (const inv of invoicesData) {
    await run(`
      INSERT INTO invoices (id, customer_id, invoice_amount, amount_paid, amount_outstanding, issue_date, due_date, payment_status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [inv.id, inv.customer_id, inv.invoice_amount, inv.amount_paid, inv.amount_outstanding, inv.issue_date, inv.due_date, inv.payment_status, inv.description]);
  }
  console.log('Inserted ' + invoicesData.length + ' invoices.');

  for (const p of paymentsData) {
    await run(`
      INSERT INTO payments (id, invoice_id, customer_id, payment_amount, payment_date, payment_status, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [p.id, p.invoice_id, p.customer_id, p.payment_amount, p.payment_date, p.payment_status, p.payment_method, p.notes]);
  }
  console.log('Inserted ' + paymentsData.length + ' payment records.');
  console.log('Database seeding complete successfully!');
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch(err => { console.error('Seed error:', err); process.exit(1); });
}

module.exports = { seedDatabase };
