const state = {
  currentView: 'dashboard',
  stats: null,
  invoices: [],
  filteredInvoices: [],
  invoiceFilter: 'ALL',
  customers: [],
  selectedCustomer: null,
  payments: [],
  aiCases: [],
  aiPipeline: null,
  aiOpsSummary: null,
  aiActivity: [],
  activeCaseDetail: null,
  recoveryFilter: 'ALL',
  searchDebounceTimer: null,
  pollingTimer: null
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function formatCompactCurrency(amount) {
  if (!amount || amount === 0) return '$0';
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(2) + 'M';
  } else if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(1) + 'K';
  }
  return formatCurrency(amount);
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

function getStateBadge(st) {
  const labels = {
    'OVERDUE': 'OVERDUE',
    'CONTACTED': 'CONTACTED',
    'PROMISED_PAYMENT': 'PROMISED PAYMENT',
    'WAITING_FOR_PAYMENT': 'WAITING PAYMENT',
    'FOLLOW_UP_DUE': 'FOLLOW-UP DUE',
    'ESCALATED': 'ESCALATED',
    'PAID': 'PAID',
    'CLOSED': 'CLOSED'
  };
  const label = labels[st] || st || 'OVERDUE';
  return '<span class="state-badge-' + (st || 'OVERDUE') + ' px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono inline-flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80"></span>' + label + '</span>';
}

function getRiskBadge(lateCount) {
  if (lateCount >= 5) {
    return '<span class="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-bold">High Risk (' + lateCount + ' Late)</span>';
  } else if (lateCount >= 2) {
    return '<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-bold">Moderate Risk (' + lateCount + ' Late)</span>';
  } else {
    return '<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-bold">Prompt (' + lateCount + ' Late)</span>';
  }
}

function getAIActionBadge(action) {
  switch (action) {
    case 'CONTACT_CUSTOMER':
      return '<span class="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded text-[11px] font-semibold">Contact Customer</span>';
    case 'WAIT_FOR_CUSTOMER_RESPONSE':
      return '<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold">Wait for Reply</span>';
    case 'WAIT_FOR_PAYMENT':
    case 'WAIT_FOR_PROMISED_PAYMENT':
      return '<span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-semibold">Wait for Payment</span>';
    case 'SEND_FOLLOW_UP':
      return '<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">Send Follow-up</span>';
    case 'ESCALATE_TO_RECOVERY_TEAM':
      return '<span class="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">Human Escalation</span>';
    case 'CLOSE_CASE':
      return '<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">Close Case</span>';
    default:
      return '<span class="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">' + (action || 'Review Case') + '</span>';
  }
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

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center space-x-2 text-white transform transition-all duration-300 pointer-events-auto ' + (type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-rose-600 border border-rose-500');
  toast.innerHTML = '<i data-lucide="' + (type === 'success' ? 'check-circle-2' : 'alert-circle') + '" class="w-4 h-4"></i><span>' + message + '</span>';
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

  ['dashboard', 'recovery', 'receivables', 'customers', 'payments', 'ai-operations', 'api-docs'].forEach(v => {
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
    'dashboard': 'Receivables Recovery Command Center',
    'recovery': 'End-to-End AI Recovery Pipeline',
    'receivables': 'Invoices & Receivables Ledger',
    'customers': 'B2B Customer Accounts Directory',
    'payments': 'Payment Transactions Ledger',
    'ai-operations': 'AI Agent Intelligence Sandbox',
    'api-docs': 'REST API Developer Console'
  };

  const subtitles = {
    'dashboard': 'AI-powered recovery operations across your outstanding accounts',
    'recovery': 'Track accounts through 8 recovery stages from overdue to settlement',
    'receivables': 'Search, filter, and settle all outstanding customer invoices',
    'customers': 'Manage risk profiles, communication tones, and accounts',
    'payments': 'Historical record of cleared ACH and wire transfers',
    'ai-operations': 'Test Gemini AI reply understanding and view live activity streams',
    'api-docs': 'Exposed REST API endpoints for agent integration'
  };

  document.getElementById('page-title').innerText = titles[viewName] || 'Receivables Recovery Command Center';
  document.getElementById('page-subtitle').innerText = subtitles[viewName] || 'AI Recovery Operations';

  if (viewName === 'dashboard') {
    loadDashboard();
  } else if (viewName === 'recovery') {
    loadRecoveryCases();
  } else if (viewName === 'receivables') {
    if (params.filter) filterInvoices(params.filter);
    else loadInvoices();
  } else if (viewName === 'customers') {
    loadCustomers();
  } else if (viewName === 'payments') {
    loadPayments();
  } else if (viewName === 'ai-operations') {
    loadSandboxCustomers();
  }

  lucide.createIcons();
}

async function loadDashboard() {
  try {
    const [statsRes, casesRes, activityRes] = await Promise.all([
      fetch('/api/dashboard/stats'),
      fetch('/api/ai/cases'),
      fetch('/api/ai/activity')
    ]);

    const statsJson = await statsRes.json();
    const casesJson = await casesRes.json();
    const activityJson = await activityRes.json();

    if (statsJson.success) {
      const d = statsJson.data;
      state.stats = d;

      document.getElementById('stat-total-outstanding').innerText = formatCompactCurrency(d.total_outstanding);
      document.getElementById('stat-total-overdue').innerText = formatCompactCurrency(d.total_overdue);
      document.getElementById('stat-total-paid').innerText = formatCompactCurrency(d.total_paid);

      const rate = (d.total_paid + d.total_outstanding) > 0
        ? ((d.total_paid / (d.total_paid + d.total_outstanding)) * 100).toFixed(1) + '%'
        : '0.0%';
      document.getElementById('stat-recovery-rate').innerText = rate;

      document.getElementById('stat-invoiced-count').innerText = d.total_invoices || '0';
      document.getElementById('stat-overdue-count').innerText = d.overdue_invoices_count || '0';
      document.getElementById('stat-paid-count').innerText = d.paid_invoices_count || '0';
      document.getElementById('stat-high-risk-cust').innerText = d.high_risk_customers_count || '0';
      document.getElementById('nav-overdue-badge').innerText = d.overdue_invoices_count || '0';

      renderAgingBreakdown(d.aging_breakdown, d.total_overdue);
    }

    if (casesJson.success) {
      state.aiCases = casesJson.cases;
      state.aiPipeline = casesJson.pipeline;
      state.aiOpsSummary = casesJson.ops_summary;

      const ops = casesJson.ops_summary;
      document.getElementById('summary-agents-active').innerText = ops.active_agents;
      document.getElementById('summary-promises-tracked').innerText = ops.promises_tracked;
      document.getElementById('summary-followups-due').innerText = ops.follow_ups_due;
      document.getElementById('summary-escalations').innerText = ops.escalations;

      document.getElementById('stat-active-cases').innerText = ops.active_agents + ' active';
      document.getElementById('nav-active-cases-badge').innerText = ops.active_agents;
      document.getElementById('sidebar-active-cases').innerText = ops.active_agents;

      renderAIOpsActivityCards(casesJson.cases);
      renderHorizontalPipeline(casesJson.pipeline);
      renderPriorityAccountsTable(casesJson.cases);
    }

    if (activityJson.success) {
      state.aiActivity = activityJson.data;
      renderLiveActivityStream(activityJson.data);
    }

    lucide.createIcons();
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

function renderAgingBreakdown(agingData, totalOverdue) {
  const container = document.getElementById('aging-breakdown-list');
  if (!container) return;
  container.innerHTML = '';

  const colors = {
    '1-30 Days': { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
    '31-60 Days': { bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700' },
    '61-90 Days': { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' },
    '90+ Days': { bar: 'bg-rose-700', badge: 'bg-rose-100 text-rose-800' }
  };

  agingData.forEach(item => {
    const pct = totalOverdue > 0 ? ((item.bucket_amount / totalOverdue) * 100).toFixed(1) : 0;
    const style = colors[item.aging_bucket] || { bar: 'bg-slate-400', badge: 'bg-slate-100' };

    const card = document.createElement('div');
    card.className = 'bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2';
    card.innerHTML = '<div class="flex justify-between items-center"><span class="text-xs font-bold text-slate-800">' + item.aging_bucket + '</span><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ' + style.badge + '">' + item.invoice_count + ' inv</span></div><div class="text-base font-black text-slate-900">' + formatCurrency(item.bucket_amount) + '</div><div class="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden"><div class="h-full ' + style.bar + ' rounded-full" style="width: ' + pct + '%"></div></div><div class="text-[10px] text-slate-400 font-mono text-right">' + pct + '% of overdue</div>';
    container.appendChild(card);
  });
}

function renderAIOpsActivityCards(cases) {
  const container = document.getElementById('ai-ops-activity-cards');
  if (!container) return;
  container.innerHTML = '';

  // Select 3 highlight cases representing PROMISED_PAYMENT, FOLLOW_UP_DUE, ESCALATED
  const highlightCases = [
    cases.find(c => c.current_state === 'PROMISED_PAYMENT') || cases[0],
    cases.find(c => c.current_state === 'FOLLOW_UP_DUE') || cases[1],
    cases.find(c => c.current_state === 'ESCALATED') || cases[2]
  ].filter(Boolean);

  highlightCases.forEach(c => {
    const card = document.createElement('div');
    card.className = 'bg-slate-950/90 rounded-xl p-4 border border-slate-800 hover:border-sky-500/40 transition flex flex-col justify-between space-y-3 cursor-pointer';
    card.onclick = () => openCaseDrawer(c.customer_id);

    const intent = c.last_intent || (c.current_state === 'PROMISED_PAYMENT' ? 'PROMISE_TO_PAY' : 'PAYMENT_QUERY');
    const message = c.last_message ? '"' + c.last_message + '"' : '"Awaiting payment confirmation."';
    const actionLabel = c.next_action.replace(/_/g, ' ');

    card.innerHTML = '<div class="space-y-2"><div class="flex items-start justify-between"><div><span class="text-[10px] font-mono text-sky-400 font-bold">' + c.customer_id + '</span><h5 class="font-bold text-white text-xs truncate max-w-[150px]">' + c.company_name + '</h5></div>' + getStateBadge(c.current_state) + '</div><div class="text-sm font-black text-rose-400 font-mono">' + formatCurrency(c.total_outstanding) + '</div><p class="text-[11px] text-slate-300 italic line-clamp-2 bg-slate-900 p-2 rounded-lg border border-slate-800">' + message + '</p></div><div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]"><div class="font-mono"><span class="text-slate-500">AI Action:</span> <span class="text-amber-300 font-bold">' + actionLabel + '</span></div><span class="text-sky-400 hover:underline font-bold">View Case →</span></div>';

    container.appendChild(card);
  });
}

function renderHorizontalPipeline(pipeline) {
  const container = document.getElementById('recovery-pipeline-container');
  if (!container) return;
  container.innerHTML = '';

  const stages = [
    { key: 'OVERDUE', label: 'OVERDUE', color: 'border-rose-300 bg-rose-50 text-rose-800' },
    { key: 'CONTACTED', label: 'CONTACTED', color: 'border-sky-300 bg-sky-50 text-sky-800' },
    { key: 'PROMISED_PAYMENT', label: 'PROMISED PAYMENT', color: 'border-blue-300 bg-blue-50 text-blue-800' },
    { key: 'WAITING_FOR_PAYMENT', label: 'WAITING PAYMENT', color: 'border-indigo-300 bg-indigo-50 text-indigo-800' },
    { key: 'FOLLOW_UP_DUE', label: 'FOLLOW-UP DUE', color: 'border-amber-300 bg-amber-50 text-amber-800' },
    { key: 'ESCALATED', label: 'ESCALATED', color: 'border-rose-400 bg-rose-100 text-rose-900' },
    { key: 'PAID', label: 'PAID', color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
    { key: 'CLOSED', label: 'CLOSED', color: 'border-slate-300 bg-slate-50 text-slate-700' }
  ];

  stages.forEach(st => {
    const data = pipeline[st.key] || { count: 0, amount: 0 };
    const step = document.createElement('div');
    step.className = 'p-3 rounded-xl border text-center transition cursor-pointer hover:shadow-md ' + st.color;
    step.onclick = () => {
      navigate('recovery');
      filterRecoveryCases(st.key);
    };

    step.innerHTML = '<span class="text-[10px] font-black uppercase tracking-wider block opacity-75">' + st.label + '</span><div class="text-lg font-black mt-1 font-mono">' + data.count + '</div><div class="text-[10px] font-bold opacity-80 mt-0.5">' + formatCompactCurrency(data.amount) + '</div>';
    container.appendChild(step);
  });
}

function renderPriorityAccountsTable(cases) {
  const tbody = document.getElementById('priority-accounts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const priorityCases = [...cases].sort((a, b) => b.overdue_amount - a.overdue_amount).slice(0, 5);

  priorityCases.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition cursor-pointer';
    tr.onclick = (e) => {
      if (e.target.tagName !== 'BUTTON') openCaseDrawer(c.customer_id);
    };

    tr.innerHTML = '<td class="py-3 px-3.5"><div class="font-bold text-slate-900 hover:text-sky-600 transition">' + c.company_name + '</div><div class="text-[11px] text-slate-400 font-mono">' + c.customer_id + ' • ' + c.contact_person + '</div></td><td class="py-3 px-3.5 text-right font-mono font-black text-rose-600">' + formatCurrency(c.total_outstanding) + '</td><td class="py-3 px-3.5 text-center"><span class="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[11px] font-mono">' + c.max_days_overdue + 'd overdue</span></td><td class="py-3 px-3.5">' + getStateBadge(c.current_state) + '</td><td class="py-3 px-3.5">' + getAIActionBadge(c.next_action) + '</td><td class="py-3 px-3.5">' + getRiskBadge(c.late_payment_count) + '</td><td class="py-3 px-3.5 text-center"><button onclick="openCaseDrawer(\'' + c.customer_id + '\')" class="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition">View Case</button></td>';

    tbody.appendChild(tr);
  });
}

function renderLiveActivityStream(activities) {
  const container = document.getElementById('live-activity-stream');
  if (!container) return;
  container.innerHTML = '';

  if (!activities || activities.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-slate-500">No activity logged yet.</div>';
    return;
  }

  activities.slice(0, 10).forEach(act => {
    const item = document.createElement('div');
    item.className = 'p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 hover:border-slate-700 transition';

    item.innerHTML = '<div class="flex items-center justify-between"><span class="font-mono text-[10px] text-sky-400 font-bold flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>' + act.time_display + '</span><span class="text-[10px] font-mono text-slate-400">' + (act.company_name || act.customer_id || 'System') + '</span></div><div class="font-bold text-white text-xs">' + act.title + '</div><div class="text-[11px] text-slate-300 font-mono">' + act.details + '</div>';

    container.appendChild(item);
  });
}

async function loadRecoveryCases() {
  try {
    const res = await fetch('/api/ai/cases');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    state.aiCases = json.cases;
    renderRecoveryCasesTable(json.cases);
  } catch (err) {
    console.error('Error loading recovery cases:', err);
  }
}

function filterRecoveryCases(st) {
  state.recoveryFilter = st;
  document.querySelectorAll('.rec-tab').forEach(b => b.classList.remove('active', 'bg-white', 'text-slate-800', 'shadow-sm'));
  const activeBtn = document.getElementById('rec-tab-' + st);
  if (activeBtn) activeBtn.classList.add('active', 'bg-white', 'text-slate-800', 'shadow-sm');

  if (!state.aiCases || state.aiCases.length === 0) {
    loadRecoveryCases();
    return;
  }
  renderRecoveryCasesTable(state.aiCases);
}

function renderRecoveryCasesTable(cases) {
  const tbody = document.getElementById('recovery-cases-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let filtered = [...cases];
  if (state.recoveryFilter !== 'ALL') {
    filtered = filtered.filter(c => c.current_state === state.recoveryFilter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-400">No recovery cases found for this filter stage.</td></tr>';
    return;
  }

  filtered.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition cursor-pointer';
    tr.onclick = (e) => {
      if (e.target.tagName !== 'BUTTON') openCaseDrawer(c.customer_id);
    };

    tr.innerHTML = '<td class="py-3 px-4"><div class="font-bold text-slate-900 hover:text-sky-600 transition">' + c.company_name + '</div><div class="text-[11px] text-slate-400 font-mono">' + c.customer_id + ' • ' + c.contact_person + '</div></td><td class="py-3 px-4 text-right font-mono font-black text-rose-600">' + formatCurrency(c.total_outstanding) + '</td><td class="py-3 px-4 text-center font-mono font-bold text-slate-700">' + c.max_days_overdue + 'd</td><td class="py-3 px-4">' + getStateBadge(c.current_state) + '</td><td class="py-3 px-4 font-mono text-emerald-700 font-bold">' + (c.promised_date || '-') + '</td><td class="py-3 px-4 font-mono text-sky-700 font-semibold">' + (c.last_intent || '-') + '</td><td class="py-3 px-4">' + getAIActionBadge(c.next_action) + '</td><td class="py-3 px-4 text-center"><button onclick="openCaseDrawer(\'' + c.customer_id + '\')" class="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition">View Case</button></td>';

    tbody.appendChild(tr);
  });
}


async function loadCaseAuditTimeline(customerId) {
  const container = document.getElementById('case-audit-timeline');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-6 text-slate-500 text-xs">
      Loading AI audit history...
    </div>
  `;

  try {
    const response = await fetch(
      '/api/ai/audit/' + encodeURIComponent(customerId)
    );
    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error || 'Unable to load audit history.');
    }

    const events = json.data || [];

    if (!events.length) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-xs">
          No persistent AI audit events recorded yet.
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    events.forEach((event, index) => {
      const item = document.createElement('div');

      const eventType = event.event_type || 'SYSTEM_EVENT';
      const action = event.action || '—';
      const intent = event.intent || '—';
      const previousState = event.previous_state || '—';
      const newState = event.new_state || '—';
      const priority = event.priority || 'NORMAL';
      const requiresHuman = Number(event.requires_human || 0) === 1;
      const success = Number(event.success) !== 0;

      let eventTime = 'Unknown time';
      if (event.created_at) {
        const normalized = event.created_at.includes('T')
          ? event.created_at
          : event.created_at.replace(' ', 'T');
        const parsed = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z');
        if (!Number.isNaN(parsed.getTime())) {
          eventTime = parsed.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }

      let icon = 'activity';
      if (eventType === 'AI_ANALYSIS') icon = 'brain';
      else if (eventType === 'ACTION_DECISION') icon = 'git-branch';
      else if (eventType === 'ACTION_EXECUTED') icon = 'zap';
      else if (eventType.includes('PAYMENT')) icon = 'circle-dollar-sign';
      else if (eventType.includes('ESCAL')) icon = 'shield-alert';

      const priorityClass =
        priority === 'CRITICAL'
          ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
          : priority === 'HIGH'
            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
            : 'bg-slate-800 text-slate-300 border-slate-700';

      const successClass = success ? 'text-emerald-400' : 'text-rose-400';

      item.className = 'relative pl-8 pb-5';

      item.innerHTML = `
        ${index < events.length - 1 ? `
          <div class="absolute left-[7px] top-7 bottom-0 w-px bg-slate-800"></div>
        ` : ''}

        <div class="
          absolute left-0 top-1 w-4 h-4 rounded-full bg-slate-900
          border border-sky-500/50 flex items-center justify-center z-10
        ">
          <i data-lucide="${icon}" class="w-2.5 h-2.5 text-sky-400"></i>
        </div>

        <div class="
          bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2
          hover:border-slate-700 transition
        ">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="
                text-[10px] font-mono font-black text-sky-400
                uppercase tracking-wider
              ">
                ${eventType.replace(/_/g, ' ')}
              </div>
              <div class="text-[10px] text-slate-500 font-mono mt-0.5">
                ${eventTime}
              </div>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap justify-end">
              ${priority !== 'NORMAL' ? `
                <span class="
                  px-2 py-0.5 rounded border text-[9px] font-bold
                  ${priorityClass}
                ">
                  ${priority}
                </span>
              ` : ''}
              <span class="${successClass} text-[9px] font-bold font-mono">
                ${success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div class="bg-slate-900 rounded-lg p-2">
              <div class="text-slate-500">INTENT</div>
              <div class="text-emerald-300 font-bold mt-0.5 break-all">
                ${intent}
              </div>
            </div>

            <div class="bg-slate-900 rounded-lg p-2">
              <div class="text-slate-500">ACTION</div>
              <div class="text-amber-300 font-bold mt-0.5 break-all">
                ${action}
              </div>
            </div>

            <div class="bg-slate-900 rounded-lg p-2">
              <div class="text-slate-500">STATE</div>
              <div class="text-sky-300 font-bold mt-0.5 break-all">
                ${previousState} → ${newState}
              </div>
            </div>

            <div class="bg-slate-900 rounded-lg p-2">
              <div class="text-slate-500">HUMAN REQUIRED</div>
              <div class="${requiresHuman ? 'text-rose-300' : 'text-emerald-300'} font-bold mt-0.5">
                ${requiresHuman ? 'YES' : 'NO'}
              </div>
            </div>
          </div>

          ${event.reason ? `
            <div class="border-t border-slate-800 pt-2 text-[10px] text-slate-400 leading-relaxed">
              <span class="text-slate-500">Agent reasoning:</span>
              ${event.reason}
            </div>
          ` : ''}

          ${event.message ? `
            <div class="text-[10px] text-slate-500 border-t border-slate-800 pt-2">
              ${event.message}
            </div>
          ` : ''}
        </div>
      `;

      container.appendChild(item);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (error) {
    console.error('Audit timeline error:', error);
    container.innerHTML = `
      <div class="text-center py-6 text-rose-400 text-xs">
        Failed to load audit history.
        <div class="text-slate-500 mt-1">${error.message}</div>
      </div>
    `;
  }
}

async function openCaseDrawer(customerId) {
  try {
    const res = await fetch('/api/customers/' + customerId);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    const cust = json.data;

    // Find agent case state
    let cCase = state.aiCases.find(c => c.customer_id === customerId);

    if (!cCase) {
      cCase = {
        customer_id: cust.id,
        company_name: cust.company_name,
        current_state: cust.total_overdue_amount > 0 ? 'OVERDUE' : 'PAID',
        next_action: cust.total_overdue_amount > 0 ? 'CONTACT_CUSTOMER' : 'CLOSE_CASE',
        promised_date: null,
        last_message: null,
        last_intent: null,
        last_execution: null
      };
    }

    state.selectedCustomer = {
      ...cust,
      last_execution: cCase.last_execution || null
    };

    state.activeCaseDetail = cCase;

    document.getElementById('case-cust-name').innerText = cust.company_name;
    document.getElementById('case-cust-id').innerText = cust.id;
    document.getElementById('case-cust-avatar').innerText = cust.company_name.substring(0, 2).toUpperCase();

    document.getElementById('case-risk-badge').className = cust.late_payment_count >= 5
      ? 'px-2.5 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30'
      : 'px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    document.getElementById('case-risk-badge').innerText = cust.late_payment_count >= 5 ? 'High Risk' : 'Moderate Risk';

    document.getElementById('case-state-badge').outerHTML = '<span id="case-state-badge">' + getStateBadge(cCase.current_state) + '</span>';

    // Financial Summary
    document.getElementById('case-fin-outstanding').innerText = formatCurrency(cust.total_outstanding_amount);

    const maxOverdueDays = cust.invoices.reduce((max, inv) => {
      if (inv.payment_status === 'OVERDUE') {
        const days = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(max, days);
      }
      return max;
    }, 0);
    document.getElementById('case-fin-overdue-days').innerText = maxOverdueDays + ' Days';
    document.getElementById('case-fin-invoices').innerText = cust.invoices.length + ' Invoices';
    document.getElementById('case-fin-late-count').innerText = cust.late_payment_count + ' Late Payments';

    // AI Recovery Status
    document.getElementById('case-ai-state').innerText = cCase.current_state;
    document.getElementById('case-ai-action').innerText = cCase.next_action;
    document.getElementById('case-ai-promise-date').innerText = cCase.promised_date || 'N/A';
    document.getElementById('case-ai-escalated').innerText = cCase.current_state === 'ESCALATED' ? 'Yes (Human Action)' : 'No';

    // AI Understanding Panel
    document.getElementById('panel-intent').innerText =
      cCase.last_intent ||
      (cCase.current_state === 'PROMISED_PAYMENT' ? 'PROMISE_TO_PAY' : 'OVERDUE_QUERY');

    document.getElementById('panel-sentiment').innerText =
      cCase.sentiment || 'Not available';

    document.getElementById('panel-confidence').innerText =
      cCase.confidence != null ? String(cCase.confidence) : 'Not available';

    document.getElementById('panel-action').innerText =
      cCase.next_action || 'NO_ACTION';

    document.getElementById('panel-reasoning').innerText =
      cCase.reasoning ||
      (cCase.last_message
        ? 'AI analyzed the latest customer statement and selected ' + (cCase.next_action || 'NO_ACTION') + '.'
        : 'Invoice is overdue. Recovery agent recommends initiating contact or sending an automated payment reminder.');


    // Render Chat Conversation Timeline
    renderCaseConversationTimeline(cust, cCase);

    // Load persistent SQLite AI audit history
    await loadCaseAuditTimeline(customerId);

    document.getElementById('drawer-case-detail').classList.remove('hidden');
    lucide.createIcons();
  } catch (err) {
    console.error('Error opening case drawer:', err);
    showToast('Failed to open case details', 'error');
  }
}

function closeCaseDrawer() {
  document.getElementById('drawer-case-detail').classList.add('hidden');
}

function renderCaseConversationTimeline(cust, cCase) {
  const timeline = document.getElementById('case-conversation-timeline');
  if (!timeline) return;
  timeline.innerHTML = '';

  const messages = [];

  if (cCase.last_message) {
    messages.push({
      sender: 'CUSTOMER',
      text: cCase.last_message,
      time: '14:32 PST',
      intent: cCase.last_intent || 'PROMISE_TO_PAY',
      sentiment: 'Cooperative',
      confidence: '95%',
      decision: cCase.next_action,
      execution: cCase.last_execution || null
    });
    if (cCase.last_outbound_message) {
      messages.push({
        sender: 'AI',
        text: cCase.last_outbound_message,
        time: 'Just now',
        intent: cCase.last_intent || 'RECOVERY_RESPONSE',
        sentiment: 'Cooperative',
        confidence: 'AI',
        decision: cCase.next_action,
        execution: cCase.last_execution || null
      });
    }
  } else {
    // Default mock conversation for demo setup
    messages.push({
      sender: 'CUSTOMER',
      text: 'Bhai kal pakka kar dunga.',
      time: '14:32 PST',
      intent: 'PROMISE_TO_PAY',
      sentiment: 'Cooperative',
      confidence: '95%',
      decision: 'WAIT_FOR_PAYMENT'
    });
  }

  messages.forEach(m => {
    const msgBlock = document.createElement('div');
    msgBlock.className = 'space-y-2';

    if (m.sender === 'AI') {
      msgBlock.innerHTML =
        '<div class="chat-bubble-ai p-3 text-xs space-y-2">' +
        '<div class="flex items-center justify-between border-b border-sky-500/20 pb-1.5">' +
        '<span class="text-[10px] font-mono text-sky-400 font-bold flex items-center">' +
        '<i data-lucide="bot" class="w-3 h-3 mr-1"></i> AI AGENT' +
        '</span>' +
        '<span class="text-[10px] font-mono text-slate-400">' +
        m.time +
        '</span>' +
        '</div>' +

        '<p class="font-medium text-white text-xs font-mono">' +
        m.text +
        '</p>' +

        '<div class="grid grid-cols-2 gap-2 text-[11px] font-mono">' +
        '<div>Intent: <strong class="text-emerald-300">' +
        m.intent +
        '</strong></div>' +

        '<div>Sentiment: <strong class="text-sky-300">' +
        m.sentiment +
        '</strong></div>' +
        '</div>' +

        '<div class="pt-1.5 border-t border-sky-500/20 text-[11px] font-mono">' +
        'Agent Decision: <strong class="text-amber-300">' +
        m.decision +
        '</strong>' +
        '</div>' +
        '</div>';
    } else {
      msgBlock.innerHTML =
        '<div class="chat-bubble-customer p-3 text-xs">' +
        '<div class="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">' +
        '<span>CUSTOMER (' + cust.contact_person + ')</span>' +
        '<span>' + m.time + '</span>' +
        '</div>' +

        '<p class="font-medium text-white text-xs font-mono font-semibold">' +
        m.text +
        '</p>' +
        '</div>';
    }

    timeline.appendChild(msgBlock);
  });

  lucide.createIcons();
}

async function submitDrawerSimMessage() {
  const input = document.getElementById('drawer-sim-message-input');
  const msg = input?.value?.trim();
  if (!msg || !state.selectedCustomer) return;

  try {
    const res = await fetch('/api/ai/process-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: state.selectedCustomer.id,
        message: msg
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const execution = json.data?.execution;
    const analysis = json.data?.analysis || {};

    if (execution) {
      showToast(
        'Executed: ' + (execution.message || execution.action),
        'success'
      );
    }
    if (json.data?.state) {
      state.selectedCustomer.last_execution =
        json.data.execution?.message || null;

      state.selectedCustomer.last_message =
        msg;

      state.selectedCustomer.last_intent =
        json.data.analysis?.intent || null;

      state.selectedCustomer.next_action =
        json.data.decision?.action || null;
    }
    if (state.activeCaseDetail && json.data) {
      state.activeCaseDetail.last_execution =
        json.data.execution?.message || null;

      state.activeCaseDetail.last_message =
        msg;

      state.activeCaseDetail.last_intent =
        json.data.analysis?.intent || null;

      state.activeCaseDetail.next_action =
        json.data.decision?.action || null;
    }

    input.value = '';
    showToast('AI processed customer message live!', 'success');

    // Reload case details
    await loadDashboard();

    await openCaseDrawer(state.selectedCustomer.id);
    prepareGmailRecoveryReply(analysis);
  } catch (err) {

    showToast(err.message, 'error');

  }

}

async function triggerCaseAction(action) {
  if (!state.selectedCustomer) return;

  try {
    // --------------------------------------------------------
    // SEND FOLLOW-UP THROUGH REAL GMAIL
    // --------------------------------------------------------
    if (action === 'SEND_FOLLOW_UP') {

      const customer = state.selectedCustomer;

      if (!customer.email) {
        throw new Error(
          'Customer email address is missing.'
        );
      }

      const message =
        'Dear ' +
        (customer.contact_person || 'Customer') +
        ',\n\n' +
        'This is a friendly follow-up regarding the outstanding payment on your account. ' +
        'Please provide an update on the expected payment date at your earliest convenience.\n\n' +
        'Best regards,\n' +
        'Accounts Receivable Team';

      const gmailRes = await fetch(
        '/api/gmail/send-reply',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            customer_id: customer.id,
            to: customer.email,
            subject:
              'Payment Recovery Follow-up - ' +
              customer.company_name,
            body: message
          })
        }
      );

      const gmailJson =
        await gmailRes.json();

      if (
        !gmailRes.ok ||
        !gmailJson.success
      ) {
        throw new Error(
          gmailJson.error ||
          'Failed to send Gmail follow-up.'
        );
      }

      showToast(
        'Follow-up email sent successfully via Gmail!',
        'success'
      );

      await loadDashboard();

      openCaseDrawer(customer.id);

      return;
    }


    // --------------------------------------------------------
    // EXISTING ACTIONS
    // --------------------------------------------------------
    const res = await fetch(
      '/api/ai/state-transition',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          customer_id:
            state.selectedCustomer.id,

          action
        })
      }
    );

    const json =
      await res.json();

    if (!json.success) {
      throw new Error(
        json.error ||
        'Action failed.'
      );
    }

    showToast(
      'Action "' +
      action +
      '" executed for customer!',
      'success'
    );

    await loadDashboard();

    openCaseDrawer(
      state.selectedCustomer.id
    );

  } catch (err) {

    console.error(
      'Case action error:',
      err
    );

    showToast(
      err.message ||
      'Action failed.',
      'error'
    );
  }
}

function openDrawerPaymentModal() {
  if (!state.selectedCustomer) return;
  const cust = state.selectedCustomer;
  const overdueInv = cust.invoices.find(i => i.amount_outstanding > 0) || cust.invoices[0];
  if (overdueInv) {
    openPaymentModal(overdueInv.id, cust.company_name, overdueInv.amount_outstanding);
  } else {
    showToast('No outstanding invoices for this customer', 'error');
  }
}

async function loadSandboxCustomers() {
  const select = document.getElementById('sandbox-customer-select');
  if (!select) return;
  const res = await fetch('/api/customers');
  const json = await res.json();
  select.innerHTML = '';
  json.data.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.company_name + ' (' + c.id + ')';
    select.appendChild(opt);
  });
}

async function runSandboxAnalysis() {
  const customerId =
    document.getElementById('sandbox-customer-select')?.value;

  const message =
    document.getElementById('sandbox-message-input')?.value?.trim();

  if (!message) {
    showToast(
      'Please enter a customer message to analyze',
      'error'
    );
    return;
  }

  try {
    const res = await fetch('/api/ai/process-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: customerId,
        message: message
      })
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(
        json.error || 'AI processing failed.'
      );
    }

    const d = json.data || {};
    const analysis = d.analysis || {};
    const decision = d.decision || {};
    const execution = d.execution || {};

    const intentEl =
      document.getElementById('sb-intent');

    const sentimentEl =
      document.getElementById('sb-sentiment');

    const actionEl =
      document.getElementById('sb-action');

    const executionEl =
      document.getElementById('sb-execution');

    const responseEl =
      document.getElementById('sb-response');

    const resultsEl =
      document.getElementById(
        'sandbox-results-container'
      );

    if (intentEl) {
      intentEl.innerText =
        analysis.intent || 'UNKNOWN';
    }

    if (sentimentEl) {
      sentimentEl.innerText =
        analysis.sentiment_analysis?.tone ||
        analysis.sentiment ||
        'Neutral';
    }

    if (actionEl) {
      actionEl.innerText =
        decision.action || 'NO_ACTION';
    }

    if (executionEl) {
      executionEl.innerText =
        execution.message ||
        execution.action ||
        'Action execution completed.';
    }

    if (responseEl) {
      responseEl.innerText =
        '"' +
        (
          analysis.suggested_response ||
          'Acknowledged customer reply.'
        ) +
        '"';
    }

    if (resultsEl) {
      resultsEl.classList.remove('hidden');
    }
    prepareGmailRecoveryReply(analysis);

    showToast(
      'AI analysis completed!',
      'success'
    );

  } catch (err) {

    console.error(
      'Sandbox AI error:',
      err
    );

    showToast(
      err.message ||
      'AI analysis failed.',
      'error'
    );
  }
}


async function refreshAllData() {
  showToast('Refreshing dashboard & AI recovery states...', 'success');
  if (state.currentView === 'dashboard') await loadDashboard();
  else if (state.currentView === 'recovery') await loadRecoveryCases();
  else if (state.currentView === 'receivables') await loadInvoices();
  else if (state.currentView === 'customers') await loadCustomers();
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
  if (activeBtn) activeBtn.classList.add('active', 'bg-white', 'text-slate-800', 'shadow-sm');
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
  if (!tbody) return;
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
    tr.innerHTML = '<td class="py-3 px-4 font-mono font-bold text-slate-800">' + inv.id + '</td><td class="py-3 px-4"><a href="javascript:void(0)" onclick="openCaseDrawer(\'' + inv.customer_id + '\')" class="font-bold text-sky-600 hover:text-sky-800 hover:underline">' + inv.company_name + '</a><div class="text-[11px] text-slate-400">' + inv.contact_person + '</div></td><td class="py-3 px-4 max-w-xs truncate text-slate-600" title="' + (inv.description || '') + '">' + (inv.description || '-') + '</td><td class="py-3 px-4 text-slate-600">' + formatDate(inv.issue_date) + '</td><td class="py-3 px-4 font-medium text-slate-800">' + formatDate(inv.due_date) + '</td><td class="py-3 px-4">' + getStatusBadge(inv.payment_status, inv.days_overdue) + '</td><td class="py-3 px-4 text-right font-semibold text-slate-700">' + formatCurrency(inv.invoice_amount) + '</td><td class="py-3 px-4 text-right font-extrabold ' + (inv.amount_outstanding > 0 ? 'text-rose-600' : 'text-emerald-600') + '">' + formatCurrency(inv.amount_outstanding) + '</td><td class="py-3 px-4 text-center"><div class="flex items-center justify-center space-x-1.5">' + (inv.amount_outstanding > 0 ? '<button onclick="openPaymentModal(\'' + inv.id + '\', \'' + inv.company_name.replace(/'/g, "\\'") + '\', ' + inv.amount_outstanding + ')" title="Record Payment" class="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs transition"><i data-lucide="dollar-sign" class="w-3.5 h-3.5"></i></button>' : '') + '<button onclick="openCaseDrawer(\'' + inv.customer_id + '\')" title="View Recovery Case" class="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs transition"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></button></div></td>';
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
  if (!grid) return;
  grid.innerHTML = '';

  if (customers.length === 0) {
    grid.innerHTML = '<div class="col-span-3 text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200"><i data-lucide="users" class="w-10 h-10 mx-auto mb-2 opacity-40"></i><p class="font-medium text-sm">No customers found matching the search criteria.</p></div>';
    lucide.createIcons();
    return;
  }

  customers.forEach(cust => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-sky-300 transition flex flex-col justify-between space-y-4';

    card.innerHTML = '<div><div class="flex items-start justify-between"><div><span class="font-mono text-[11px] text-slate-400 font-semibold">' + cust.id + '</span><h4 class="font-bold text-slate-900 text-sm hover:text-sky-600 transition cursor-pointer" onclick="openCaseDrawer(\'' + cust.id + '\')">' + cust.company_name + '</h4></div>' + getRiskBadge(cust.late_payment_count) + '</div><div class="mt-3 space-y-1 text-xs text-slate-600"><div class="flex items-center"><i data-lucide="user" class="w-3.5 h-3.5 mr-1.5 text-slate-400"></i>' + cust.contact_person + '</div><div class="flex items-center"><i data-lucide="mail" class="w-3.5 h-3.5 mr-1.5 text-slate-400"></i>' + cust.email + '</div><div class="flex items-center"><i data-lucide="phone" class="w-3.5 h-3.5 mr-1.5 text-slate-400"></i>' + cust.phone + '</div></div><div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs"><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium text-[11px]">' + cust.preferred_language + '</span><span class="bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-medium text-[11px]">' + cust.preferred_communication_tone + '</span></div></div><div class="pt-3 border-t border-slate-100 flex items-center justify-between"><div><span class="text-[10px] text-slate-400 uppercase font-semibold block">Outstanding</span><span class="text-sm font-extrabold ' + (cust.total_outstanding_amount > 0 ? 'text-rose-600' : 'text-emerald-600') + '">' + formatCurrency(cust.total_outstanding_amount) + '</span></div><button onclick="openCaseDrawer(\'' + cust.id + '\')" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition"><span>View Case</span><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button></div>';

    grid.appendChild(card);
  });

  lucide.createIcons();
}

async function loadPayments() {
  try {
    const res = await fetch('/api/payments');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    state.payments = json.data;

    document.getElementById('payments-count-badge').innerText = json.data.length + ' Payments Logged';

    const tbody = document.getElementById('all-payments-table-body');
    if (!tbody) return;
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

    await loadDashboard();
    if (state.selectedCustomer) {
      openCaseDrawer(state.selectedCustomer.id);
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
    await loadDashboard();
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
    await loadDashboard();
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
    await loadDashboard();
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

function updateLiveClock() {
  const clockEl = document.getElementById('live-clock-display');
  if (clockEl) {
    const now = new Date();
    clockEl.innerText = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const baseEl = document.getElementById('api-base-url-display');
  if (baseEl) baseEl.innerText = window.location.origin + '/api';

  updateLiveClock();
  setInterval(updateLiveClock, 10000);

  // Auto-polling ticker every 15 seconds to fetch latest activity and cases
  state.pollingTimer = setInterval(() => {
    if (state.currentView === 'dashboard') {
      fetch('/api/ai/activity').then(r => r.json()).then(j => {
        if (j.success) renderLiveActivityStream(j.data);
      }).catch(() => { });
    }
  }, 15000);

  navigate('dashboard');
});

/* ============================================================
   GMAIL RECOVERY REPLY
   ============================================================ */

function prepareGmailRecoveryReply(analysis) {

  const textarea =
    document.getElementById(
      'gmail-reply-body'
    );

  const recipient =
    document.getElementById(
      'gmail-reply-recipient'
    );

  const button =
    document.getElementById(
      'gmail-send-reply-btn'
    );

  if (!textarea ||
    !recipient ||
    !button) {

    return;
  }


  const customer =
    state.selectedCustomer;

  if (!customer) {
    return;
  }


  const suggestedResponse =
    analysis?.suggested_response ||
    analysis?.analysis?.suggested_response ||
    '';


  textarea.value =
    suggestedResponse;


  recipient.innerText =
    customer.email ||
    'Email unavailable';


  button.disabled =
    !suggestedResponse ||
    !customer.email;
}


/* ============================================================
   SEND HUMAN-APPROVED RESPONSE VIA GMAIL
   ============================================================ */

async function sendGmailRecoveryReply() {

  const textarea =
    document.getElementById(
      'gmail-reply-body'
    );

  const button =
    document.getElementById(
      'gmail-send-reply-btn'
    );

  if (!textarea ||
    !button) {

    return;
  }


  const body =
    textarea.value.trim();


  if (!body) {

    showToast(
      'Recovery message is empty.',
      'error'
    );

    return;
  }


  const customer =
    state.selectedCustomer;


  if (!customer) {

    showToast(
      'No customer selected.',
      'error'
    );

    return;
  }


  if (!customer.email) {

    showToast(
      'Customer email address is missing.',
      'error'
    );

    return;
  }


  try {

    button.disabled = true;


    const span =
      button.querySelector('span');


    if (span) {
      span.innerText =
        'Sending...';
    }


    const response =
      await fetch(
        '/api/gmail/send-reply',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({

            customer_id:
              customer.id,

            to:
              customer.email,

            subject:
              'Payment Recovery Update - ' +
              customer.company_name,

            body:
              body

          })
        }
      );


    const result =
      await response.json();


    if (!response.ok ||
      !result.success) {

      throw new Error(
        result.error ||
        'Gmail send failed.'
      );
    }


    showToast(
      'Recovery reply sent successfully via Gmail!',
      'success'
    );


    textarea.value = '';


    button.disabled = false;


  } catch (error) {

    console.error(
      '[GMAIL] Send error:',
      error
    );


    showToast(
      error.message ||
      'Failed to send Gmail reply.',
      'error'
    );


  } finally {

    const span =
      button.querySelector('span');

    if (span) {
      span.innerText =
        'Send via Gmail';
    }

  }

}


/* ============================================================
   PROCESS UNREAD GMAIL
   ============================================================ */

async function processGmailInbox() {

  const button =
    document.getElementById(
      'gmail-process-btn'
    );

  if (!button) {
    return;
  }


  try {

    button.disabled = true;


    const span =
      button.querySelector('span');


    if (span) {
      span.innerText =
        'Processing Gmail...';
    }


    const response =
      await fetch(
        '/api/gmail/process-unread',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            limit: 10
          })
        }
      );


    const result =
      await response.json();


    if (!response.ok ||
      result.success === false) {

      throw new Error(
        result.error ||
        'Gmail processing failed.'
      );
    }


    showToast(
      'Gmail inbox processed successfully!',
      'success'
    );


    if (
      typeof loadDashboard ===
      'function'
    ) {

      await loadDashboard();
    }


  } catch (error) {

    console.error(
      '[GMAIL] Processing error:',
      error
    );


    showToast(
      error.message ||
      'Gmail processing failed.',
      'error'
    );


  } finally {

    button.disabled = false;


    const span =
      button.querySelector('span');


    if (span) {
      span.innerText =
        'Process Unread Gmail';
    }

  }

}
