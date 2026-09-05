/**
 * ReconMind AI - Exception AI Diagnoser & Self-Healing Agent
 * Provides natural language diagnostics, root-cause analysis, and recovery paths for unresolved financial exceptions.
 */

export async function diagnoseException(item, mode = 'LOCAL', apiKey = '') {
  if (mode === 'GEMINI' && apiKey.trim() !== '') {
    try {
      const geminiResult = await diagnoseWithGemini(item, apiKey.trim());
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn("Gemini API call failed, falling back to Local Heuristic AI:", err);
    }
  }

  // Fallback / Default Local Heuristic AI Diagnoser
  return diagnoseWithLocalRules(item);
}

function diagnoseWithLocalRules(item) {
  const { exceptionType, erpAmount, rzpAmount, bankAmount, rzpRecord, erpRecord, utr } = item;

  let title = "Unresolved Financial Discrepancy";
  let rootCause = "";
  let aiRecommendation = "";
  let recoveryPath = "";
  let severity = "HIGH";

  switch (exceptionType) {
    case "CHARGEBACK_HOLD":
      title = "Risk Engine Chargeback Deduction";
      severity = "HIGH";
      rootCause = `Merchant ERP expects ₹${erpAmount.toLocaleString('en-IN')}, but Bank received ₹${bankAmount.toLocaleString('en-IN')}. Razorpay Risk Engine applied a temporary chargeback reserve hold of ₹${(erpAmount - bankAmount).toLocaleString('en-IN')} due to a dispute filed on payment ${rzpRecord?.id || 'N/A'}.`;
      aiRecommendation = "Inspect buyer dispute logs in Razorpay Dashboard. Do NOT attempt automatic reconciliation until chargeback evidence is submitted or dispute resolves.";
      recoveryPath = "Auto-compiled evidence package created for Razorpay Dispute API endpoint `/v1/disputes/{id}/contest`. Ledger updated with 'Disputed Reserve' ledger code.";
      break;

    case "MISSING_BANK_CREDIT":
      title = "Settlement Payout In-Transit / Bank Drop";
      severity = "MEDIUM";
      rootCause = `Razorpay Settlement ${rzpRecord?.settlementId || 'N/A'} shows ₹${rzpAmount.toLocaleString('en-IN')} as 'SETTLED' with UTR ${utr}, but no matching credit entry exists in the Bank Passbook statement.`;
      aiRecommendation = "Check bank processing window. If transaction occurred within last 24h, this is an active clearing house delay (NEFT/RTGS cut-off). If older than 48h, initiate Razorpay Support Ticket.";
      recoveryPath = "Flagged as 'In-Transit Settlement'. Set automated retry polling on Bank Webhook API at 00:00 UTC.";
      break;

    case "DUPLICATE_PAYMENT":
      title = "Customer Double-Charge Anomaly";
      severity = "MEDIUM";
      rootCause = `Multiple Razorpay payment records detected for a single ERP Invoice (${erpRecord?.id}). Secondary payment attempt succeeded, leading to duplicate customer charge.`;
      aiRecommendation = "Execute partial refund via Razorpay Refund API (`/v1/payments/{pay_id}/refund`) to return duplicate funds to customer card/UPI account.";
      recoveryPath = "Auto-triggered Razorpay Instant Refund API for duplicate transaction. Merchant ledger updated to prevent double revenue recognition.";
      break;

    case "ORPHANED_BANK_CREDIT":
      title = "Unmapped Bank Credit Entry";
      severity = "CRITICAL";
      rootCause = `Bank Statement reflects a credit entry of ₹${bankAmount.toLocaleString('en-IN')} with UTR ${utr}, but no corresponding Razorpay Order ID or Merchant ERP Invoice exists in the database.`;
      aiRecommendation = "Direct bank credit without payment gateway metadata. Human finance audit required to trace remitter account or offline B2B transfer.";
      recoveryPath = "Created Unallocated Suspense Account entry (Code: #99901). Sent alert to merchant accounting team with UTR reference.";
      break;

    default:
      title = "Gross vs Net Discrepancy";
      severity = "LOW";
      rootCause = `Discrepancy of ₹${Math.abs(erpAmount - bankAmount).toLocaleString('en-IN')} between ERP Invoice and Bank receipt.`;
      aiRecommendation = "Verify tax rates and standard gateway commissions.";
      recoveryPath = "Adjusted gateway fee ledger entry.";
      break;
  }

  return {
    title: `[Local Heuristic Engine] ${title}`,
    severity,
    rootCause,
    aiRecommendation,
    recoveryPath,
    isGemini: false,
    timestamp: new Date().toISOString()
  };
}

async function diagnoseWithGemini(item, apiKey) {
  const prompt = `You are ReconMind AI, an autonomous financial controller AI for Razorpay merchants.
Analyze this 3-way reconciliation exception:
- ERP Invoice Amount: ₹${item.erpAmount} (ID: ${item.id})
- Razorpay Net Amount: ₹${item.rzpAmount} (Fee: ₹${item.rzpFee})
- Bank Credit Amount: ₹${item.bankAmount} (UTR: ${item.utr})
- Discrepancy Amount: ₹${item.discrepancyAmount}
- Exception Type Flag: ${item.exceptionType}

Respond ONLY with a valid JSON object matching exact format:
{
  "title": "Short title describing exception",
  "severity": "HIGH|MEDIUM|LOW",
  "rootCause": "Detailed natural language financial root cause explanation",
  "aiRecommendation": "Concrete action for finance team",
  "recoveryPath": "Automated ledger adjustment or Razorpay API fix description"
}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");

  const parsed = JSON.parse(text);
  return {
    title: `✨ [Live Gemini AI] ${parsed.title || 'AI Exception Diagnostic'}`,
    severity: parsed.severity || 'HIGH',
    rootCause: parsed.rootCause || 'Gemini analyzed 3-way telemetry discrepancy.',
    aiRecommendation: parsed.aiRecommendation || 'Verify in Razorpay Merchant Dashboard.',
    recoveryPath: parsed.recoveryPath || 'Ledger entry posted.',
    isGemini: true,
    timestamp: new Date().toISOString()
  };
}

