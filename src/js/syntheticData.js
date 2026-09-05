/**
 * ReconMind AI - Synthetic Financial Data Generator (With Dynamic Fault Injection)
 * Generates realistic multi-source datasets with real-world edge cases & fault injection modes.
 */

export function generateSyntheticBatch(count = 52, faultMode = "DEFAULT") {
  const razorpaySettlements = [];
  const bankStatements = [];
  const erpInvoices = [];

  const customerNames = [
    "Rahul Sharma", "Priya Patel", "Vikram Malhotra", "Ananya Sen", 
    "Amitabh Roy", "Deepika Padukone", "Siddharth Nair", "Neha Kapoor",
    "Rohan Gupta", "Kavita Reddy", "Arjun Mehta", "Sanya Verma",
    "Karan Johar", "Tarun Khanna", "Meera Joshi", "Devendra Fadnavis",
    "Pooja Hegde", "Varun Dhawan", "Shraddha Das", "Aditya Roy"
  ];

  const baseDate = new Date(2026, 8, 1, 10, 0, 0);

  // Dynamic Fee Rate based on Fault Mode
  const feeRate = faultMode === "FEE_HIKE" ? 0.035 : 0.02; // 3.5% vs 2%

  for (let i = 1; i <= count; i++) {
    const orderNum = 1000 + i;
    const orderId = `order_Kz${orderNum}`;
    const payId = `pay_Py${8000 + i}`;
    const utr = `UTR2026090${String(i).padStart(3, '0')}`;
    const invId = `INV-2026-${String(i).padStart(4, '0')}`;
    const customer = customerNames[i % customerNames.length];
    
    const baseAmount = Math.floor(Math.random() * 400 + 10) * 100;
    
    const razorpayFee = Math.round(baseAmount * feeRate);
    const gstTax = Math.round(razorpayFee * 0.18);
    const netPayout = baseAmount - razorpayFee - gstTax;
    
    const txDate = new Date(baseDate.getTime() + (i * 3600000));
    const dateStr = txDate.toISOString().split('T')[0];

    let scenario = "EXACT_MATCH";

    if (faultMode === "FRAUD_BURST") {
      if (i % 3 === 0) scenario = "UNRESOLVED_CHARGEBACK_HOLD";
    } else if (faultMode === "BANK_OUTAGE") {
      if (i % 2 === 0) scenario = "BANK_DELAY";
    } else {
      if (i % 7 === 0) scenario = "FEE_DEDUCTION";
      else if (i % 11 === 0) scenario = "BANK_DELAY";
      else if (i === 15) scenario = "UNRESOLVED_CHARGEBACK_HOLD";
      else if (i === 28) scenario = "UNRESOLVED_DUPLICATE_PAYMENT";
      else if (i === 42) scenario = "UNRESOLVED_MISSING_BANK_RECORD";
      else if (i === 50) scenario = "UNRESOLVED_ORPHANED_BANK_CREDIT";
    }

    const erpRecord = {
      id: invId,
      orderId: orderId,
      customerName: customer,
      grossAmount: baseAmount,
      currency: "INR",
      date: dateStr,
      status: "PAID"
    };

    let rzpRecord = {
      id: payId,
      orderId: orderId,
      settlementId: `setl_St${900 + Math.floor(i / 5)}`,
      grossAmount: baseAmount,
      fee: razorpayFee,
      tax: gstTax,
      netAmount: netPayout,
      utr: utr,
      date: dateStr,
      status: "SETTLED"
    };

    const bankDate = new Date(txDate);
    if (scenario === "BANK_DELAY" || faultMode === "BANK_OUTAGE") {
      bankDate.setDate(bankDate.getDate() + (faultMode === "BANK_OUTAGE" ? 4 : 2));
    }

    let bankRecord = {
      id: `BNK-CR-${5000 + i}`,
      utr: utr,
      creditAmount: netPayout,
      date: bankDate.toISOString().split('T')[0],
      description: `NEFT-RZP SETTLE-${payId}`,
      status: "CREDITED"
    };

    if (scenario === "UNRESOLVED_CHARGEBACK_HOLD") {
      rzpRecord.netAmount = netPayout - 2000;
      bankRecord.creditAmount = netPayout - 2000;
      rzpRecord.notes = "Chargeback hold applied by risk engine";
    } else if (scenario === "UNRESOLVED_DUPLICATE_PAYMENT") {
      rzpRecord.notes = "Duplicate authorization attempt";
    } else if (scenario === "UNRESOLVED_MISSING_BANK_RECORD") {
      bankRecord = null;
    } else if (scenario === "UNRESOLVED_ORPHANED_BANK_CREDIT") {
      bankRecord = {
        id: `BNK-CR-9999`,
        utr: "UTR_ORPHAN_X7",
        creditAmount: 18400,
        date: dateStr,
        description: "UNKNOWN DIRECT TRANSFER",
        status: "CREDITED"
      };
      rzpRecord = null;
      erpRecord.status = "UNPAID";
    }

    if (erpRecord) erpInvoices.push(erpRecord);
    if (rzpRecord) razorpaySettlements.push(rzpRecord);
    if (bankRecord) bankStatements.push(bankRecord);
  }

  return {
    razorpaySettlements,
    bankStatements,
    erpInvoices,
    totalRecords: count,
    faultMode
  };
}
