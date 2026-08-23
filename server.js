require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeSchema, get } = require('./db');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/styles.css') && !req.url.startsWith('/app.js')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Existing CRM & AR routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));

// Part 2: AI Intelligence Engine route
app.use('/api/ai', require('./routes/ai'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'B2B Mock Accounts Receivable & CRM System',
    version: '1.0.0'
  });
});

app.post('/api/seed', async (req, res) => {
  try {
    await seedDatabase();
    res.json({ success: true, message: 'Database reset and seeded with 32+ customers and 65 invoices!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

async function start() {
  try {
    await initializeSchema();
    const countRow = await get('SELECT COUNT(*) as count FROM customers');
    if (!countRow || countRow.count === 0) {
      console.log('Database is empty. Automatically seeding demo dataset...');
      await seedDatabase();
    } else {
      console.log(`Database already contains ${countRow.count} customers. Ready!`);
    }

    app.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(`🚀 Mock CRM & Accounts Receivable ERP is LIVE!`);
      console.log(`📍 Web Dashboard:  http://localhost:${PORT}`);
      console.log(`🔌 REST API Base:   http://localhost:${PORT}/api`);
      console.log(`🤖 AI Engine API:  http://localhost:${PORT}/api/ai/analyze-reply`);
      console.log(`📖 API Docs UI:    http://localhost:${PORT}#api-docs`);
      console.log(`===================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
