const router = require("express").Router();
const crypto = require("crypto");
const Payment = require("../models/Payment");
const { protect } = require("../middleware/auth");

router.use(protect);

const generateRef = () => `HN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// Initiate a payment
router.post("/initiate", async (req, res) => {
  try {
    const { patientId, amount, service } = req.body;
    const transactionRef = generateRef();

    const payment = await Payment.create({
      patient: patientId,
      amount,
      service,
      transactionRef,
      processedBy: req.user._id,
      status: "pending",
    });

    // Interswitch payment URL payload
    const interswitchPayload = {
      merchantCode: process.env.INTERSWITCH_CLIENT_ID,
      payableCode: "Default_Payable_MX26070",
      amount: amount * 100, // kobo
      transactionReference: transactionRef,
      currencyCode: "566", // NGN
      customerEmail: req.body.email || "patient@healthnet.ng",
      redirectUrl: `${req.protocol}://${req.get("host")}/api/payments/verify/${transactionRef}`,
    };

    res.json({ transactionRef, payment, interswitchPayload, paymentUrl: `${process.env.INTERSWITCH_BASE_URL}/collections/api/v1/pay` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Verify payment callback
router.get("/verify/:ref", async (req, res) => {
  try {
    const payment = await Payment.findOne({ transactionRef: req.params.ref });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });

    // In production: call Interswitch requery API to confirm status
    // For MVP: trust the callback and mark as success
    payment.status = req.query.resp === "00" ? "success" : "failed";
    payment.interswitchRef = req.query.txnref || null;
    await payment.save();

    res.json({ status: payment.status, transactionRef: payment.transactionRef, amount: payment.amount, service: payment.service });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get payment history for a patient
router.get("/patient/:patientId", async (req, res) => {
  try {
    const payments = await Payment.find({ patient: req.params.patientId }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
