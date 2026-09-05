/**
 * ReconMind AI - Main Application Controller (God-Tier Version)
 */

import { generateSyntheticBatch } from './syntheticData.js';
import { runReconciliation } from './reconEngine.js';
import { diagnoseException } from './exceptionAI.js';
import { renderReconFunnel, renderRevenueDonut } from './charts.js';
import { ReconCopilot } from './copilot.js';

let currentDataset = null;
let reconResults = null;
let currentFilter = 'ALL';
let currentFaultMode = 'DEFAULT';
let searchQuery = '';
let copilot = null;
let activeDrawerItem = null;
let aiEngineMode = 'LOCAL';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  copilot = new ReconCopilot(window);
  setupEventListeners();
  loadData();
}

function loadData(faultMode = currentFaultMode) {
  currentFaultMode = faultMode;
  currentDataset = generateSyntheticBatch(52, faultMode);
  reconResults = runReconciliation(currentDataset);
  
  renderStats();
  renderCharts();
  renderTable();
  renderTerminalLog();
  renderCodePreviews();
}

function renderStats() {
  const { metrics } = reconResults;
  
  document.getElementById('stat-total-records').innerText = metrics.totalProcessed;
  document.getElementById('stat-match-rate').innerText = `${metrics.matchRate}%`;
  document.getElementById('stat-matched-count').innerText = metrics.matchedCount + metrics.feeMatchedCount;
  
  const lakhs = (metrics.totalSettledVolume / 100000).toFixed(1);
  document.getElementById('stat-settled-volume').innerText = `₹${lakhs}L`;
  
  document.getElementById('stat-unresolved-count').innerText = metrics.unresolvedCount;
}

function renderCharts() {
  if (!reconResults) return;
  renderReconFunnel('chart-funnel', reconResults.metrics);
  renderRevenueDonut('chart-donut', reconResults.metrics);
}

function renderTerminalLog() {
  const terminal = document.getElementById('terminal-log-content');
  if (!terminal || !reconResults || !reconResults.logs) return;

  terminal.innerHTML = reconResults.logs.map(log => `<div>${log}</div>`).join('');
  terminal.scrollTop = terminal.scrollHeight;
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  let items = reconResults.items;

  if (currentFilter === 'MATCHED') {
    items = items.filter(i => i.status === 'MATCHED' || i.status === 'MATCHED_WITH_FEE' || i.status === 'MATCHED_SELF_HEALED');
  } else if (currentFilter === 'UNRESOLVED') {
    items = items.filter(i => i.status === 'UNRESOLVED_EXCEPTION');
  }

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    items = items.filter(i => 
      (i.id && i.id.toLowerCase().includes(q)) ||
      (i.orderId && i.orderId.toLowerCase().includes(q)) ||
      (i.customerName && i.customerName.toLowerCase().includes(q)) ||
      (i.utr && i.utr.toLowerCase().includes(q))
    );
  }

  document.getElementById('table-subtitle').innerText = `Showing ${items.length} of ${reconResults.items.length} records`;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-dim);">
          No matching records found for the selected filter or search query.
        </td>
      </tr>
    `;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');

    let badgeHtml = '';
    if (item.status === 'MATCHED') {
      badgeHtml = `<span class="badge badge-matched">✓ Exact Match</span>`;
    } else if (item.status === 'MATCHED_WITH_FEE') {
      badgeHtml = `<span class="badge badge-fuzzy">⚡ Fee Adjusted</span>`;
    } else if (item.status === 'MATCHED_SELF_HEALED') {
      badgeHtml = `<span class="badge badge-healed">✓ AI Self-Healed</span>`;
    } else {
      badgeHtml = `<span class="badge badge-unresolved">⚠️ Unresolved</span>`;
    }

    let actionBtnHtml = '';
    if (item.status === 'UNRESOLVED_EXCEPTION') {
      actionBtnHtml = `<button class="btn-inspect" data-id="${item.id}">Inspect AI Diagnosis</button>`;
    } else {
      actionBtnHtml = `<span style="font-size:0.75rem; color:var(--emerald-accent);">Verified Logged</span>`;
    }

    tr.innerHTML = `
      <td>
        <div style="font-weight:600;">${item.id}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${item.customerName}</div>
      </td>
      <td>
        <span class="id-badge">${item.orderId}</span>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.2rem;">UTR: ${item.utr}</div>
      </td>
      <td class="amount">₹${item.erpAmount.toLocaleString('en-IN')}</td>
      <td class="amount" style="color:var(--purple-glow);">₹${item.rzpFee.toLocaleString('en-IN')}</td>
      <td class="amount" style="color:var(--cyan-glow);">₹${item.bankAmount.toLocaleString('en-IN')}</td>
      <td>
        <div style="font-family:var(--font-mono); font-weight:700; color:${item.confidenceScore > 90 ? 'var(--emerald-accent)' : 'var(--rose-alert)'};">
          ${item.confidenceScore}%
        </div>
        <div style="font-size:0.7rem; color:var(--text-dim);">${item.matchPass.split(':')[0]}</div>
      </td>
      <td>${badgeHtml}</td>
      <td>${actionBtnHtml}</td>
    `;

    tbody.appendChild(tr);
  });

  tbody.onclick = (e) => {
    const btn = e.target.closest('.btn-inspect');
    if (btn) {
      const id = btn.getAttribute('data-id');
      if (id) openExceptionDrawer(id);
    }
  };
}



async function openExceptionDrawer(id) {
  const item = reconResults.items.find(i => i.id === id);
  if (!item) return;

  activeDrawerItem = item;

  document.getElementById('drawer-id-badge').innerText = item.id;
  document.getElementById('drawer-ai-title').innerText = aiEngineMode === 'GEMINI' ? '✨ Gemini AI analyzing 3-way telemetry...' : 'Loading AI diagnosis...';
  document.getElementById('drawer-ai-rootcause').innerText = 'Synthesizing ERP, Razorpay, and Bank Passbook logs...';
  
  const toast = document.getElementById('drawer-healed-toast');
  if (toast) toast.style.display = 'none';

  const apiKeyInput = document.getElementById('gemini-api-key-input');
  const apiKey = apiKeyInput ? apiKeyInput.value : '';

  const drawerOverlay = document.getElementById('drawer-overlay');
  drawerOverlay.classList.add('active');

  const diag = await diagnoseException(item, aiEngineMode, apiKey);

  document.getElementById('drawer-ai-title').innerText = diag.title;
  document.getElementById('drawer-ai-rootcause').innerText = diag.rootCause;

  document.getElementById('drawer-src-erp').innerText = `₹${item.erpAmount.toLocaleString('en-IN')}`;
  document.getElementById('drawer-src-erp-sub').innerText = item.id;

  document.getElementById('drawer-src-rzp').innerText = `₹${item.rzpAmount.toLocaleString('en-IN')}`;
  document.getElementById('drawer-src-rzp-sub').innerText = item.rzpRecord ? item.rzpRecord.id : 'NO RECORD';

  document.getElementById('drawer-src-bank').innerText = `₹${item.bankAmount.toLocaleString('en-IN')}`;
  document.getElementById('drawer-src-bank-sub').innerText = item.utr;

  document.getElementById('drawer-audit-hash').innerText = item.auditHash || "0x7f89a201b8e4c9901";

  document.getElementById('drawer-ai-recommendation').innerText = diag.aiRecommendation;
  document.getElementById('drawer-ai-recovery').innerText = diag.recoveryPath;
}

function closeExceptionDrawer() {
  document.getElementById('drawer-overlay').classList.remove('active');
  activeDrawerItem = null;
}

function renderCodePreviews() {
  if (!currentDataset) return;

  const rzpPreview = JSON.stringify(currentDataset.razorpaySettlements.slice(0, 3), null, 2);
  const bankPreview = JSON.stringify(currentDataset.bankStatements.slice(0, 3), null, 2);
  const erpPreview = JSON.stringify(currentDataset.erpInvoices.slice(0, 3), null, 2);

  document.getElementById('code-rzp-preview').innerText = rzpPreview;
  document.getElementById('code-bank-preview').innerText = bankPreview;
  document.getElementById('code-erp-preview').innerText = erpPreview;
}

function setupEventListeners() {
  // AI Engine Pills
  const btnLocal = document.getElementById('btn-engine-local');
  const btnGemini = document.getElementById('btn-engine-gemini');
  const keyBox = document.getElementById('gemini-key-box');

  if (btnLocal && btnGemini) {
    btnLocal.addEventListener('click', () => {
      btnLocal.classList.add('active');
      btnGemini.classList.remove('active');
      aiEngineMode = 'LOCAL';
      if (keyBox) keyBox.style.display = 'none';
    });

    btnGemini.addEventListener('click', () => {
      btnGemini.classList.add('active');
      btnLocal.classList.remove('active');
      aiEngineMode = 'GEMINI';
      if (keyBox) keyBox.style.display = 'flex';
    });
  }

  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(v => v.style.display = 'none');

      btn.classList.add('active');
      const tabName = btn.getAttribute('data-tab');
      document.getElementById(`view-${tabName}`).style.display = 'block';
    });
  });

  // Fault Injection Buttons
  document.querySelectorAll('.btn-fault').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-fault').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-fault');
      loadData(mode);
    });
  });

  // Table Filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilter = btn.getAttribute('data-filter');
      renderTable();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
  });

  // Regenerate Batch
  document.getElementById('btn-rebatch').addEventListener('click', () => {
    loadData(currentFaultMode);
  });

  // CFO Report Button
  document.getElementById('btn-cfo-report').addEventListener('click', () => {
    const res = copilot.processQuery("Generate CFO Audit Briefing");
    alert(res.reply);
  });

  // Drawer Close
  document.getElementById('btn-close-drawer').addEventListener('click', closeExceptionDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'drawer-overlay') closeExceptionDrawer();
  });

  // Export CSV
  document.getElementById('btn-export').addEventListener('click', exportCSV);

  // ReconCopilot Toggle
  const copilotBtn = document.getElementById('btn-copilot-trigger');
  const copilotPanel = document.getElementById('copilot-panel');
  const copilotClose = document.getElementById('btn-close-copilot');

  copilotBtn.addEventListener('click', () => {
    copilotPanel.classList.toggle('active');
  });

  copilotClose.addEventListener('click', () => {
    copilotPanel.classList.remove('active');
  });

  // Copilot Send
  document.getElementById('btn-send-copilot').addEventListener('click', handleCopilotSend);
  document.getElementById('copilot-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCopilotSend();
  });

  // Copy Full Submission Writeup
  const btnCopyAll = document.getElementById('btn-copy-all');
  if (btnCopyAll) {
    btnCopyAll.addEventListener('click', () => {
      const text = document.getElementById('view-submission').innerText;
      navigator.clipboard.writeText(text);
      alert('Full Buildathon submission package copied to clipboard!');
    });
  }

  // Interactive Stateful Self-Healing Action Button
  document.getElementById('btn-resolve-exception').addEventListener('click', () => {
    if (!activeDrawerItem || !reconResults) return;

    // 1. Update item state
    activeDrawerItem.status = 'MATCHED_SELF_HEALED';
    activeDrawerItem.matchPass = 'Pass 4: AI Self-Healed & Reconciled';
    activeDrawerItem.confidenceScore = 100;

    // 2. Recalculate metrics
    const m = reconResults.metrics;
    m.unresolvedCount = Math.max(0, m.unresolvedCount - 1);
    m.feeMatchedCount += 1;
    m.totalSettledVolume += (activeDrawerItem.bankAmount || activeDrawerItem.erpAmount);
    
    const totalMatched = m.matchedCount + m.feeMatchedCount;
    m.matchRate = parseFloat(((totalMatched / m.totalProcessed) * 100).toFixed(1));

    // 3. Append to real-time audit log
    const timestamp = new Date().toLocaleTimeString();
    reconResults.logs.push(`[${timestamp}] [SELF_HEAL] Executed AI journal entry offset for ${activeDrawerItem.id}. SHA-256 ledger hash ${activeDrawerItem.auditHash} registered.`);

    // 4. Show success animation toast inside drawer
    const toast = document.getElementById('drawer-healed-toast');
    if (toast) toast.style.display = 'flex';

    // 5. Re-render UI
    renderStats();
    renderCharts();
    renderTable();
    renderTerminalLog();

    // 6. Close drawer after short delay
    setTimeout(() => {
      closeExceptionDrawer();
    }, 1200);
  });
}


function handleCopilotSend() {
  const input = document.getElementById('copilot-input');
  const query = input.value.trim();
  if (!query) return;

  const chatBody = document.getElementById('copilot-body');

  // Add User Msg
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.innerText = query;
  chatBody.appendChild(userMsg);

  input.value = '';

  // Process Agent Response
  setTimeout(() => {
    const res = copilot.processQuery(query);
    const agentMsg = document.createElement('div');
    agentMsg.className = 'chat-msg agent';
    agentMsg.innerText = res.reply;
    chatBody.appendChild(agentMsg);

    chatBody.scrollTop = chatBody.scrollHeight;

    if (res.action === 'INSPECT_CHARGEBACK') {
      openExceptionDrawer('INV-2026-0015');
    } else if (res.action === 'INJECT_FEE_HIKE') {
      document.querySelector('[data-fault="FEE_HIKE"]').click();
    }
  }, 400);
}

function exportCSV() {
  if (!reconResults) return;

  let csvContent = "data:text/csv;charset=utf-8,Invoice_ID,Customer_Name,Order_ID,UTR,ERP_Gross,RZP_Fee,Bank_Credit,Match_Status,Match_Pass,Confidence_Score,SHA256_Audit_Hash\n";

  reconResults.items.forEach(i => {
    csvContent += `"${i.id}","${i.customerName}","${i.orderId}","${i.utr}",${i.erpAmount},${i.rzpFee},${i.bankAmount},"${i.status}","${i.matchPass}",${i.confidenceScore},"${i.auditHash}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ReconMind_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
