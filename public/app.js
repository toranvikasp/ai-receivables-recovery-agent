const state = {
  currentView: 'dashboard',
  stats: null,
  invoices: [],
  filteredInvoices: [],
  invoiceFilter: 'ALL',
  customers: [],
  selectedCustomer: null,
  payments: [],
  searchDebounceTimer: null
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateString;
}

function getStatusBadge(status, daysOverdue = 0) {
  switch (status) {
    case 'OVERDUE':
      return '<span class="badge-overdue px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse"></span>Overdue (' + (daysOverdue > 0 ? daysOverdue + 'd' : 'Due') + ')</span>';
    case 'PENDING':
      return '<span class="badge-pending px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Pending</span>';
    case 'PARTIALLY_PAID':
      return '<span class="badge-partial px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>Partially Paid</span>';
    case 'PAID':
      return '<span class="badge-paid px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Paid</span>';
    default:
      return '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">' + status + '</span>';
  }
}

function getRiskBadge(lateCount) {
  if (lateCount >= 5) {
    return '<span class="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">High Risk (' + lateCount + ' Late)</span>';
  } else if (lateCount >= 2) {
    return '<span class="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">Medium Risk (' + lateCount + ' Late)</span>';
  } else {
    return '<span class="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">Prompt (' + lateCount + ' Late)</span>';
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center space-x-2 text-white transform transition-all duration-300 pointer-events-auto ' + (type === 'success' ? 'bg-emerald-600' : 'bg-rose-600');
  toast.innerHTML = '<i data-lucide="' + (type === 'success' ? 'check-circle' : 'alert-circle') + '" class="w-4 h-4"></i><span>' + message + '</span>';
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function navigate(viewName, params = {}) {
  state.currentView = viewName;
  
  ['dashboard', 'receivables', 'customers', 'customer-detail', 'payments', 'api-docs'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.add('hidden');
    const nav = document.getElementById('nav-' + v);
    if (nav) nav.classList.remove('active');
  });

  const activeEl = document.getElementById('view-' + viewName);
  if (activeEl) activeEl.classList.remove('hidden');

  const activeNav = document.getElementById('nav-' + viewName);
  if (activeNav) activeNav.classList.add('active');

  const titles = {
    'dashboard': 'Receivables Overview & Financial Metrics',
    'receivables': 'Invoices & Receivables Management',
    'customers': 'B2B Customer Accounts Directory',
    'customer-detail': 'Customer Profile & Payment History',
    'payments': 'Payment Transactions Ledger',
    'api-docs': 'REST API Developer Console'
  };
  document.getElementById('page-title').innerText = titles[viewName] || 'Accounts Receivable CRM';

  if (viewName === 'dashboard') {
    loadDashboard();
  } else if (viewName === 'receivables') {
    if (params.filter) {
      filterInvoices(params.filter);
    } else {
      loadInvoices();
    }
  } else if (viewName === 'customers') {
    loadCustomers();
  } else if (viewName === 'payments') {
    loadPayments();
  }

  lucide.createIcons();
}

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const data = json.data;
    state.stats = data;

    document.getElementById('stat-total-outstanding').innerText = formatCurrency(data.total_outstanding);
    document.getElementById('stat-total-overdue').innerText = formatCurrency(data.total_overdue);
    document.getElementById('stat-overdue-count').innerText = data.overdue_invoices_count;
    document.getElementById('stat-total-paid').innerText = formatCurrency(data.total_paid);

    document.getElementById('stat-invoiced-count').innerText = data.total_invoices || '0';
    document.getElementById('stat-paid-count').innerText = data.paid_invoices_count || '0';
    document.getElementById('stat-high-risk-cust').innerText = data.high_risk_customers_count || '0';
    document.getElementById('stat-total-customers-badge').innerText = data.total_customers || '32';
    
    document.getElementById('nav-overdue-badge').innerText = data.overdue_invoices_count || '0';

    const agingContainer = document.getElementById('aging-breakdown-list');
    agingContainer.innerHTML = '';
    const colors = {
      '1-30 Days': 'bg-amber-400',
      '31-60 Days': 'bg-orange-500',
      '61-90 Days': 'bg-rose-500',
      '90+ Days': 'bg-rose-700'
    };

    data.aging_breakdown.forEach(item => {
      const pct = data.total_overdue > 0 ? ((item.bucket_amount / data.total_overdue) * 100).toFixed(1) : 0;
      const row = document.createElement('div');
      row.className = 'space-y-1.5';
      row.innerHTML = '<div class="flex justify-between text-xs font-semibold text-slate-700"><span class="flex items-center"><span class="w-2 h-2 rounded-full ' + (colors[item.aging_bucket] || 'bg-slate-400') + ' mr-2"></span>' + item.aging_bucket + '</span><span>' + formatCurrency(item.bucket_amount) + ' <span class="text-slate-400 font-normal">(' + item.invoice_count + ' inv, ' + pct + '%)</span></span></div><div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div class="h-full ' + (colors[item.aging_bucket] || 'bg-slate-400') + ' rounded-full" style="width: ' + pct + '%"></div></div>';
      agingContainer.appendChild(row);
    });

    const topOverdueTbody = document.getElementById('top-overdue-table-body');
    topOverdueTbody.innerHTML = '';

    data.top_overdue_invoices.forEach(inv => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = '<td class="py-3 px-3 font-mono font-semibold text-slate-900">' + inv.id + '</td><td class="py-3 px-3"><a href="javascript:void(0)" onclick="viewCustomerDetails(\'' + inv.customer_id + '\')" class="font-bold text-sky-600 hover:text-sky-800 hover:underline block">' + inv.company_name + '</a><span class="text-slate-400 text-[11px]">' + inv.contact_person + '</span></td><td class="py-3 px-3"><span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[11px]">' + inv.days_overdue + ' days</span></td><td class="py-3 px-3 text-right font-extrabold text-slate-900">' + formatCurrency(inv.amount_outstanding) + '</td><td class="py-3 px-3 text-center"><button onclick="openPaymentModal(\'' + inv.id + '\', \'' + inv.company_name.replace(/'/g, "\\'") + '\', ' + inv.amount_outstanding + ')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-semibold text-xs transition">Record Pay</button></td>';
      topOverdueTbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    console.error('Error in loadDashboard:', err);
  }
}

async function loadInvoices() {
  try {
    const res = await fetch('/api/invoices');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    state.invoices = json.data;
    applyInvoiceFilters();
  } catch (err) {
    console.error('Error loading invoices:', err);
  }
}

function filterInvoices(status) {
  state.invoiceFilter = status;
  document.querySelectorAll('.inv-tab').forEach(b => b.classList.remove('active', 'bg-white', 'text-slate-800', 'shadow-sm'));
  const activeBtn = document.getElementById('tab-inv-' + status);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-white', 'text-slate-800', 'shadow-sm');
  }
  loadInvoices();
}

function debounceInvoiceSearch() {
  clearTimeout(state.searchDebounceTimer);
  state.searchDebounceTimer = setTimeout(() => {
    applyInvoiceFilters();
  }, 200);
}

function sortInvoices() {
  applyInvoiceFilters();
}

function applyInvoiceFilters() {
  const searchTerm = (document.getElementById('invoice-search-input')?.value || '').toLowerCase().trim();
  const sortVal = document.getElementById('invoice-sort-select')?.value || 'due_date-ASC';
  const [sortField, sortOrder] = sortVal.split('-');

  let filtered = [...state.invoices];

  if (state.invoiceFilter !== 'ALL') {
    filtered = filtered.filter(i => i.payment_status === state.invoiceFilter);
  }

  if (searchTerm) {
    filtered = filtered.filter(i => 
      i.id.toLowerCase().includes(searchTerm) ||
      i.company_name.toLowerCase().includes(searchTerm) ||
      (i.description && i.description.toLowerCase().includes(searchTerm))
    );
  }

  filtered.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (sortField === 'company') {
      valA = a.company_name;
      valB = b.company_name;
    }
    if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
    if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
    return 0;
  });

  state.filteredInvoices = filtered;
  renderInvoicesTable(filtered);
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-table-body');
  tbody.innerHTML = '';

  let totalOutstanding = 0;

  if (invoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-10 text-slate-400"><i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i><p>No invoices matching your filter criteria.</p></td></tr>';
    lucide.createIcons();
    return;
  }

  invoices.forEach(inv => {
    totalOutstanding += inv.amount_outstanding;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = '<td class="py-3 px-4 font-mono font-bold text-slate-800">' + inv.id + '</td><td class="py-3 px-4"><a href="javascript:void(0)" onclick="viewCustomerDetails(\'' + inv.customer_id + '\')" class="font-bold text-sky-600 hover:text-sky-800 hover:underline">' + inv.company_name + '</a><div class="text-[11px] text-slate-400">' + inv.contact_person + '</div></td><td class="py-3 px-4 max-w-xs truncate text-slate-600" title="' + (inv.description || '') + '">' + (inv.description || '-') + '</td><td class="py-3 px-4 text-slate-600">' + formatDate(inv.issue_date) + '</td><td class="py-3 px-4 font-medium text-slate-800">' + formatDate(inv.due_date) + '</td><td class="py-3 px-4">' + getStatusBadge(inv.payment_status, inv.days_overdue) + '</td><td class="py-3 px-4 text-right font-semibold text-slate-700">' + formatCurrency(inv.invoice_amount) + '</td><td class="py-3 px-4 text-right font-extrabold ' + (inv.amount_outstanding > 0 ? 'text-rose-600' : 'text-emerald-600') + '">' + formatCurrency(inv.amount_outstanding) + '</td><td class="py-3 px-4 text-center"><div class="flex items-center justify-center space-x-1.5">' + (inv.amount_outstanding > 0 ? '<button onclick="openPaymentModal(\'' + inv.id + '\', \'' + inv.company_name.replace(/'/g, "\\'") + '\', ' + inv.amount_outstanding + ')" title="Record Payment" class="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs transition"><i data-lucide="dollar-sign" class="w-3.5 h-3.5"></i></button>' : '') + '<button onclick="viewCustomerDetails(\'' + inv.customer_id + '\')" title="View Customer Profile" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></button></div></td>';
    tbody.appendChild(tr);
  });

  document.getElementById('invoices-count-label').innerText = 'Showing ' + invoices.length + ' invoices';
  document.getElementById('invoices-outstanding-sum').innerText = 'Total Outstanding: ' + formatCurrency(totalOutstanding);

  lucide.createIcons();
}

async function loadCustomers() {
  try {
    const tone = document.getElementById('customer-tone-filter')?.value || '';
    const lang = document.getElementById('customer-lang-filter')?.value || '';
    const risk = document.getElementById('customer-risk-filter')?.value || '';
    const search = document.getElementById('customer-search-input')?.value || '';

    const params = new URLSearchParams();
    if (tone) params.set('tone', tone);
    if (lang) params.set('language', lang);
    if (risk) params.set('risk', risk);
    if (search) params.set('search', search);

    const res = await fetch('/api/customers?' + params.toString());
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    state.customers = json.data;
    renderCustomersGrid(json.data);
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

function debounceCustomerSearch() {
  clearTimeout(state.searchDebounceTimer);
  state.searchDebounceTimer = setTimeout(() => {
    loadCustomers();
  }, 200);
}

function renderCustomersGrid(customers) {
  const grid = document.getElementById('customers-grid');
  grid.innerHTML = '';

  if (customers.length === 0) {
    grid.innerHTML = '<div class="col-span-3 text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200"><i data-lucide="users" class="w-10 h-10 mx-auto mb-2 opacity-40"></i><p class="font-medium text-sm">No customers found matching the search and filter criteria.</p></div>';
    lucide.createIcons();
    return;
  }

  customers.forEach(cust => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-sky-300 transition flex flex-col justify-between space-y-4';
    
    card.innerHTML = '<div><div class="flex items-start justify-between"><div><span class="font-mono text-[11px] text-slate-400 font-semibold">' + cust.id + '</span><h4 class="font-bold text-slate-900 text-sm hover:text-sky-600 transition cursor-pointer" onclick="viewCustomerDetails(\'' + cust.id + '\')">' + cust.company_name + '</h4></div>' + getRiskBadge(cust.late_payment_count) + '</div><div class="mt-3 space-y-1 text-xs text-slate-600"><div class="flex items-center"><i data-lucide="user" class="w-3.5 h-3.5 mr-1.5 text-slate-400"></i>' + cust.contact_person + '</div><div class="flex items-center"><i data-lucide="mail" class="w-3.5 h-3.5 mr-1.5 text-slate-400"></i>' + cust.email + '</div><div class="flex items-center"><i data-lucide="phone" class="w-3.5 h-3.5 mr-1.5 text-slate-400"></i>' + cust.phone + '</div></div><div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs"><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium text-[11px]">' + cust.preferred_language + '</span><span class="bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-medium text-[11px]">' + cust.preferred_communication_tone + '</span></div></div><div class="pt-3 border-t border-slate-100 flex items-center justify-between"><div><span class="text-[10px] text-slate-400 uppercase font-semibold block">Outstanding</span><span class="text-sm font-extrabold ' + (cust.total_outstanding_amount > 0 ? 'text-rose-600' : 'text-emerald-600') + '">' + formatCurrency(cust.total_outstanding_amount) + '</span></div><button onclick="viewCustomerDetails(\'' + cust.id + '\')" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"><span>View Account</span><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button></div>';
    grid.appendChild(card);
  });

  lucide.createIcons();
}

async function viewCustomerDetails(customerId) {
  try {
    const res = await fetch('/api/customers/' + customerId);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const cust = json.data;
    state.selectedCustomer = cust;

    document.getElementById('detail-cust-name').innerText = cust.company_name;
    document.getElementById('detail-cust-id-badge').innerText = cust.id;
    document.getElementById('detail-cust-avatar').innerText = cust.company_name.substring(0, 2).toUpperCase();
    document.getElementById('detail-cust-contact').innerText = cust.contact_person;
    document.getElementById('detail-cust-email').innerText = cust.email;
    document.getElementById('detail-cust-phone').innerText = cust.phone;
    document.getElementById('detail-cust-lang').innerText = cust.preferred_language;
    document.getElementById('detail-cust-tone').innerText = cust.preferred_communication_tone;
    document.getElementById('detail-cust-late-count').innerText = cust.late_payment_count;
    document.getElementById('detail-cust-behavior-notes').innerText = '"' + (cust.payment_behavior_notes || 'No specific notes recorded.') + '"';

    const riskBadgeEl = document.getElementById('detail-cust-risk-badge');
    if (cust.late_payment_count >= 5) {
      riskBadgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-800 border border-rose-200';
      riskBadgeEl.innerText = 'High Delinquency Risk';
    } else if (cust.late_payment_count >= 2) {
      riskBadgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-200';
      riskBadgeEl.innerText = 'Moderate Risk';
    } else {
      riskBadgeEl.className = 'text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200';
      riskBadgeEl.innerText = 'Prompt Payer';
    }

    document.getElementById('detail-stat-billed').innerText = formatCurrency(cust.total_invoiced_amount);
    document.getElementById('detail-stat-paid').innerText = formatCurrency(cust.total_paid_amount);
    document.getElementById('detail-stat-outstanding').innerText = formatCurrency(cust.total_outstanding_amount);
    document.getElementById('detail-stat-overdue').innerText = formatCurrency(cust.total_overdue_amount);

    document.getElementById('detail-invoices-badge').innerText = cust.invoices.length;
    document.getElementById('detail-payments-badge').innerText = cust.payments.length;

    renderCustomerDetailInvoices(cust.invoices);
    renderCustomerDetailPayments(cust.payments);

    navigate('customer-detail');
    switchCustomerDetailTab('invoices');
  } catch (err) {
    console.error('Error in viewCustomerDetails:', err);
    showToast('Failed to load customer details', 'error');
  }
}

function switchCustomerDetailTab(tab) {
  const invPane = document.getElementById('cust-detail-invoices-pane');
  const payPane = document.getElementById('cust-detail-payments-pane');
  const tabInv = document.getElementById('cust-tab-invoices');
  const tabPay = document.getElementById('cust-tab-payments');

  if (tab === 'invoices') {
    invPane.classList.remove('hidden');
    payPane.classList.add('hidden');
    tabInv.className = 'py-3 text-xs font-bold border-b-2 border-sky-600 text-sky-600 flex items-center space-x-2';
    tabPay.className = 'py-3 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center space-x-2';
  } else {
    invPane.classList.add('hidden');
    payPane.classList.remove('hidden');
    tabPay.className = 'py-3 text-xs font-bold border-b-2 border-sky-600 text-sky-600 flex items-center space-x-2';
    tabInv.className = 'py-3 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center space-x-2';
  }
}

function renderCustomerDetailInvoices(invoices) {
  const tbody = document.getElementById('cust-detail-invoices-table');
  tbody.innerHTML = '';

  if (!invoices || invoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-400">No invoices recorded for this customer.</td></tr>';
    return;
  }

  invoices.forEach(inv => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = '<td class="py-2.5 px-3 font-mono font-bold text-slate-900">' + inv.id + '</td><td class="py-2.5 px-3 text-slate-700">' + (inv.description || '-') + '</td><td class="py-2.5 px-3 text-slate-600">' + formatDate(inv.issue_date) + '</td><td class="py-2.5 px-3 font-medium text-slate-800">' + formatDate(inv.due_date) + '</td><td class="py-2.5 px-3">' + getStatusBadge(inv.payment_status) + '</td><td class="py-2.5 px-3 text-right font-semibold text-slate-800">' + formatCurrency(inv.invoice_amount) + '</td><td class="py-2.5 px-3 text-right font-extrabold ' + (inv.amount_outstanding > 0 ? 'text-rose-600' : 'text-emerald-600') + '">' + formatCurrency(inv.amount_outstanding) + '</td><td class="py-2.5 px-3 text-center">' + (inv.amount_outstanding > 0 ? '<button onclick="openPaymentModal(\'' + inv.id + '\', \'' + state.selectedCustomer.company_name.replace(/'/g, "\\'") + '\', ' + inv.amount_outstanding + ')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-semibold text-xs transition">Record Pay</button>' : '<span class="text-emerald-600 font-semibold text-[11px]">Paid</span>') + '</td>';
    tbody.appendChild(tr);
  });
}

function renderCustomerDetailPayments(payments) {
  const tbody = document.getElementById('cust-detail-payments-table');
  tbody.innerHTML = '';

  if (!payments || payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">No payment receipts logged yet.</td></tr>';
    return;
  }

  payments.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = '<td class="py-2.5 px-3 font-mono font-bold text-slate-800">' + p.id + '</td><td class="py-2.5 px-3 font-mono text-slate-600">' + p.invoice_id + '</td><td class="py-2.5 px-3 text-slate-700">' + formatDate(p.payment_date) + '</td><td class="py-2.5 px-3 font-medium text-slate-800">' + p.payment_method + '</td><td class="py-2.5 px-3"><span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">Completed</span></td><td class="py-2.5 px-3 text-slate-500 italic">' + (p.notes || '-') + '</td><td class="py-2.5 px-3 text-right font-extrabold text-emerald-700">' + formatCurrency(p.payment_amount) + '</td>';
    tbody.appendChild(tr);
  });
}

async function loadPayments() {
  try {
    const res = await fetch('/api/payments');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    state.payments = json.data;

    document.getElementById('payments-count-badge').innerText = json.data.length + ' Payments Logged';

    const tbody = document.getElementById('all-payments-table-body');
    tbody.innerHTML = '';

    json.data.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = '<td class="py-3 px-4 font-mono font-bold text-slate-900">' + p.id + '</td><td class="py-3 px-4 font-mono text-sky-600 font-semibold">' + p.invoice_id + '</td><td class="py-3 px-4 font-bold text-slate-800">' + p.company_name + '</td><td class="py-3 px-4 text-slate-600">' + formatDate(p.payment_date) + '</td><td class="py-3 px-4 font-medium text-slate-700">' + p.payment_method + '</td><td class="py-3 px-4"><span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-semibold">Completed</span></td><td class="py-3 px-4 text-slate-500 italic">' + (p.notes || '-') + '</td><td class="py-3 px-4 text-right font-extrabold text-emerald-700">' + formatCurrency(p.payment_amount) + '</td>';
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (err) {
    console.error('Error loading payments ledger:', err);
  }
}

function openPaymentModal(invoiceId, companyName, outstanding) {
  document.getElementById('pay-invoice-id').value = invoiceId;
  document.getElementById('pay-invoice-display').value = invoiceId;
  document.getElementById('pay-customer-display').value = companyName;
  document.getElementById('pay-outstanding-display').value = formatCurrency(outstanding);
  document.getElementById('pay-amount-input').value = outstanding;
  document.getElementById('pay-amount-input').max = outstanding;
  document.getElementById('pay-date-input').value = new Date().toISOString().split('T')[0];
  document.getElementById('pay-notes-input').value = '';

  document.getElementById('modal-payment').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('modal-payment').classList.add('hidden');
}

async function submitRecordPayment(e) {
  e.preventDefault();
  const invoiceId = document.getElementById('pay-invoice-id').value;
  const payment_amount = parseFloat(document.getElementById('pay-amount-input').value);
  const payment_date = document.getElementById('pay-date-input').value;
  const payment_method = document.getElementById('pay-method-input').value;
  const notes = document.getElementById('pay-notes-input').value;

  try {
    const res = await fetch('/api/invoices/' + invoiceId + '/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_amount, payment_date, payment_method, notes })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closePaymentModal();
    showToast('Payment of ' + formatCurrency(payment_amount) + ' recorded for ' + invoiceId + '!', 'success');

    if (state.currentView === 'dashboard') loadDashboard();
    else if (state.currentView === 'receivables') loadInvoices();
    else if (state.currentView === 'customer-detail' && state.selectedCustomer) {
      viewCustomerDetails(state.selectedCustomer.id);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openCreateInvoiceModal() {
  const res = await fetch('/api/customers');
  const json = await res.json();
  const select = document.getElementById('new-inv-customer');
  select.innerHTML = '';
  json.data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.company_name + ' (' + c.id + ')';
    select.appendChild(opt);
  });

  const due = new Date();
  due.setDate(due.getDate() + 30);
  document.getElementById('new-inv-duedate').value = due.toISOString().split('T')[0];
  document.getElementById('new-inv-amount').value = '';
  document.getElementById('new-inv-desc').value = '';

  document.getElementById('modal-create-invoice').classList.remove('hidden');
}

function openCreateInvoiceForCustomerModal() {
  openCreateInvoiceModal().then(() => {
    if (state.selectedCustomer) {
      document.getElementById('new-inv-customer').value = state.selectedCustomer.id;
    }
  });
}

function closeCreateInvoiceModal() {
  document.getElementById('modal-create-invoice').classList.add('hidden');
}

async function submitCreateInvoice(e) {
  e.preventDefault();
  const customer_id = document.getElementById('new-inv-customer').value;
  const invoice_amount = parseFloat(document.getElementById('new-inv-amount').value);
  const due_date = document.getElementById('new-inv-duedate').value;
  const description = document.getElementById('new-inv-desc').value;

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id, invoice_amount, due_date, description })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closeCreateInvoiceModal();
    showToast('Invoice ' + json.data.id + ' created successfully!', 'success');

    if (state.currentView === 'dashboard') loadDashboard();
    else if (state.currentView === 'receivables') loadInvoices();
    else if (state.currentView === 'customer-detail' && state.selectedCustomer) {
      viewCustomerDetails(state.selectedCustomer.id);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCreateCustomerModal() {
  document.getElementById('modal-customer-title').innerText = 'Add New Customer';
  document.getElementById('cust-form-id').value = '';
  document.getElementById('cust-form-company').value = '';
  document.getElementById('cust-form-contact').value = '';
  document.getElementById('cust-form-email').value = '';
  document.getElementById('cust-form-phone').value = '';
  document.getElementById('cust-form-lang').value = 'English';
  document.getElementById('cust-form-tone').value = 'Formal & Direct';
  document.getElementById('cust-form-late-count').value = 0;
  document.getElementById('cust-form-behavior').value = '';

  document.getElementById('modal-customer').classList.remove('hidden');
}

function openEditCustomerModal() {
  if (!state.selectedCustomer) return;
  const c = state.selectedCustomer;
  document.getElementById('modal-customer-title').innerText = 'Edit ' + c.company_name;
  document.getElementById('cust-form-id').value = c.id;
  document.getElementById('cust-form-company').value = c.company_name;
  document.getElementById('cust-form-contact').value = c.contact_person;
  document.getElementById('cust-form-email').value = c.email;
  document.getElementById('cust-form-phone').value = c.phone;
  document.getElementById('cust-form-lang').value = c.preferred_language;
  document.getElementById('cust-form-tone').value = c.preferred_communication_tone;
  document.getElementById('cust-form-late-count').value = c.late_payment_count;
  document.getElementById('cust-form-behavior').value = c.payment_behavior_notes || '';

  document.getElementById('modal-customer').classList.remove('hidden');
}

function closeCustomerModal() {
  document.getElementById('modal-customer').classList.add('hidden');
}

async function submitCustomerForm(e) {
  e.preventDefault();
  const id = document.getElementById('cust-form-id').value;
  const payload = {
    company_name: document.getElementById('cust-form-company').value,
    contact_person: document.getElementById('cust-form-contact').value,
    email: document.getElementById('cust-form-email').value,
    phone: document.getElementById('cust-form-phone').value,
    preferred_language: document.getElementById('cust-form-lang').value,
    preferred_communication_tone: document.getElementById('cust-form-tone').value,
    late_payment_count: parseInt(document.getElementById('cust-form-late-count').value, 10),
    payment_behavior_notes: document.getElementById('cust-form-behavior').value
  };

  try {
    let res;
    if (id) {
      res = await fetch('/api/customers/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closeCustomerModal();
    showToast('Customer ' + json.data.company_name + ' saved!', 'success');

    if (state.currentView === 'customers') loadCustomers();
    else if (state.currentView === 'customer-detail') viewCustomerDetails(json.data.id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function reseedDatabase() {
  if (!confirm('Reset and re-seed the demo database with 32+ customers and 65 invoices?')) return;
  try {
    const res = await fetch('/api/seed', { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast('Database reset and re-seeded successfully!', 'success');
    navigate(state.currentView);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function testApiEndpoint(path) {
  try {
    document.getElementById('api-modal-endpoint').innerText = 'GET ' + path;
    document.getElementById('api-modal-json').innerText = 'Loading...';
    document.getElementById('modal-api-response').classList.remove('hidden');

    const res = await fetch(path);
    const json = await res.json();
    document.getElementById('api-modal-json').innerText = JSON.stringify(json, null, 2);
  } catch (err) {
    document.getElementById('api-modal-json').innerText = 'Error: ' + err.message;
  }
}

function closeApiResponseModal() {
  document.getElementById('modal-api-response').classList.add('hidden');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('api-base-url-display').innerText = window.location.origin + '/api';
  navigate('dashboard');
});
