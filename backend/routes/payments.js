const router = require("express").Router();
const crypto = require("crypto");
const axios = require("axios");
const Payment = require("../models/Payment");
const { protect } = require("../middleware/auth");

const QA_URL       = "https://qa.interswitchng.com";
const MERCHANT_CODE = "MX6072";
const PAY_ITEM_ID   = "9405967";

const generateRef = () =>
  `HN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// POST /api/payments/initiate
router.post("/initiate", protect, async (req, res) => {
  try {
    const { patientId, amount, service, email } = req.body;
    if (!patientId || !amount || !service)
      return res.status(400).json({ message: "patientId, amount and service are required" });

    const transactionRef = generateRef();
    const payment = await Payment.create({
      patient: patientId,
      amount: parseFloat(amount),
      service,
      transactionRef,
      processedBy: req.user._id,
      status: "pending",
    });

    res.json({ transactionRef, payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/confirm — app calls this after inline checkout completes
router.post("/confirm", protect, async (req, res) => {
  try {
    const { transactionRef, responseCode, interswitchRef } = req.body;
    const payment = await Payment.findOne({ transactionRef });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });

    // Server-side verify with Interswitch
    try {
      const amountKobo = Math.round(payment.amount * 100);
      const { data } = await axios.get(
        `${QA_URL}/collections/api/v1/gettransaction.json?merchantcode=${MERCHANT_CODE}&transactionreference=${transactionRef}&amount=${amountKobo}`,
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      console.log("ISW verify response:", JSON.stringify(data));
      payment.status = data.ResponseCode === "00" ? "success" : "failed";
      payment.interswitchRef = data.PaymentReference || interswitchRef || null;
    } catch (e) {
      // Fallback to client-reported code if verify fails
      payment.status = responseCode === "00" ? "success" : responseCode === "Z6" ? "pending" : "failed";
      if (interswitchRef) payment.interswitchRef = interswitchRef;
    }

    await payment.save();
    res.json({
      status: payment.status,
      transactionRef: payment.transactionRef,
      amount: payment.amount,
      service: payment.service,
      interswitchRef: payment.interswitchRef,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/patient/:patientId
router.get("/patient/:patientId", protect, async (req, res) => {
  try {
    const payments = await Payment.find({ patient: req.params.patientId }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
