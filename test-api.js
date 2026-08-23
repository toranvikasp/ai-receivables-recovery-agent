const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Automated API Endpoint Verification...');
  let passed = 0;
  let failed = 0;

  async function assertEndpoint(name, fn) {
    try {
      await fn();
      console.log('  ✅ PASS: ' + name);
      passed++;
    } catch (e) {
      console.error('  ❌ FAIL: ' + name + ' -> ' + e.message);
      failed++;
    }
  }

  await assertEndpoint('GET /api/health', async () => {
    const res = await makeRequest('/api/health');
    if (res.status !== 200 || res.data.status !== 'healthy') throw new Error('Health check failed');
  });

  await assertEndpoint('GET /api/dashboard/stats', async () => {
    const res = await makeRequest('/api/dashboard/stats');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get stats');
    if (res.data.data.total_outstanding <= 0) throw new Error('Total outstanding is invalid');
  });

  await assertEndpoint('GET /api/customers (at least 30)', async () => {
    const res = await makeRequest('/api/customers');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get customers');
    if (res.data.count < 30) throw new Error('Expected >=30 customers, found ' + res.data.count);
  });

  await assertEndpoint('GET /api/customers/:id (CUST-1001)', async () => {
    const res = await makeRequest('/api/customers/CUST-1001');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get customer');
    if (res.data.data.preferred_communication_tone !== 'Formal & Direct') throw new Error('Customer tone mismatch');
  });

  await assertEndpoint('GET /api/customers/:id/invoices', async () => {
    const res = await makeRequest('/api/customers/CUST-1001/invoices');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get customer invoices');
    if (res.data.count === 0) throw new Error('Expected customer invoices');
  });

  await assertEndpoint('GET /api/customers/:id/payments', async () => {
    const res = await makeRequest('/api/customers/CUST-1001/payments');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get customer payments');
  });

  await assertEndpoint('GET /api/invoices (at least 50)', async () => {
    const res = await makeRequest('/api/invoices');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get invoices');
    if (res.data.count < 50) throw new Error('Expected >=50 invoices, found ' + res.data.count);
  });

  await assertEndpoint('GET /api/invoices/overdue', async () => {
    const res = await makeRequest('/api/invoices/overdue');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get overdue invoices');
    if (res.data.count === 0) throw new Error('Expected overdue invoices');
  });

  await assertEndpoint('GET /api/invoices/:id (INV-2024-001)', async () => {
    const res = await makeRequest('/api/invoices/INV-2024-001');
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to get invoice');
  });

  await assertEndpoint('POST /api/invoices/:id/payments (Mutation)', async () => {
    const res = await makeRequest('/api/invoices/INV-2024-001/payments', 'POST', {
      payment_amount: 500.00,
      payment_method: 'ACH Transfer',
      notes: 'Automated test installment'
    });
    if (res.status !== 201 || !res.data.success) throw new Error('Failed to record payment');
    if (res.data.invoice.amount_paid < 500.00) throw new Error('Invoice amount_paid not updated correctly');
  });

  await assertEndpoint('PATCH /api/invoices/:id', async () => {
    const res = await makeRequest('/api/invoices/INV-2024-001', 'PATCH', {
      description: 'Updated test description via API'
    });
    if (res.status !== 200 || !res.data.success) throw new Error('Failed to update invoice');
  });

  console.log('\n🏁 Test Suite Complete: ' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
