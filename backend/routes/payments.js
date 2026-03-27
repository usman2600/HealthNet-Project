const router = require("express").Router();
const crypto = require("crypto");
const axios = require("axios");
const Payment = require("../models/Payment");
const { protect } = require("../middleware/auth");

const BASE_URL = process.env.INTERSWITCH_BASE_URL; // https://sandbox.interswitchng.com
const CLIENT_ID = process.env.INTERSWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.INTERSWITCH_CLIENT_SECRET;
const PAYABLE_CODE = "Default_Payable_MX26070";
const MERCHANT_CODE = "MX26070";

const generateRef = () =>
  `HN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const { data } = await axios.post(
    `${BASE_URL}/passport/oauth/token`,
    "grant_type=client_credentials&scope=profile",
    { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return data.access_token;
}

// POST /api/payments/initiate — creates pending record, returns transactionRef
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

// POST /api/payments/pay — charge card directly via Interswitch Purchase API
router.post("/pay", protect, async (req, res) => {
  try {
    const { transactionRef, pan, expiry, cvv, pin } = req.body;
    // expiry format: MMYY
    if (!transactionRef || !pan || !expiry || !cvv)
      return res.status(400).json({ message: "Card details incomplete" });

    const payment = await Payment.findOne({ transactionRef });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });

    const amountInKobo = Math.round(payment.amount * 100);
    const token = await getAccessToken();

    // Build Interswitch Purchase request
    const purchasePayload = {
      customerId: payment._id.toString(),
      amount: amountInKobo,
      transactionRef,
      currency: "NGN",
      description: payment.service,
      cardNumber: pan.replace(/\s/g, ""),
      cardExpiry: expiry, // MMYY
      cardCvv: cvv,
      cardPin: pin || "",
      merchantCode: MERCHANT_CODE,
      payableCode: PAYABLE_CODE,
    };

    const { data } = await axios.post(
      `${BASE_URL}/api/v2/purchases`,
      purchasePayload,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    // Handle OTP/3DS challenge
    if (data.responseCode === "T0" || data.responseCode === "S0") {
      // OTP required
      payment.interswitchRef = data.transactionRef || data.otpTransactionIdentifier;
      await payment.save();
      return res.json({ requiresOtp: true, message: data.message, otpRef: payment.interswitchRef });
    }

    payment.status = data.responseCode === "00" ? "success" : "failed";
    payment.interswitchRef = data.transactionRef || null;
    await payment.save();

    res.json({ status: payment.status, transactionRef, amount: payment.amount, service: payment.service, interswitchRef: payment.interswitchRef });
  } catch (err) {
    console.error("Pay error:", err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// POST /api/payments/otp — submit OTP for 3DS/OTP-challenged transactions
router.post("/otp", protect, async (req, res) => {
  try {
    const { transactionRef, otp } = req.body;
    const payment = await Payment.findOne({ transactionRef });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });

    const token = await getAccessToken();
    const { data } = await axios.post(
      `${BASE_URL}/api/v2/purchases/otps/auths`,
      { otp, otpTransactionIdentifier: payment.interswitchRef, transactionRef },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    payment.status = data.responseCode === "00" ? "success" : "failed";
    await payment.save();

    res.json({ status: payment.status, transactionRef, amount: payment.amount, service: payment.service });
  } catch (err) {
    console.error("OTP error:", err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// GET /api/payments/status/:ref — get payment status
router.get("/status/:ref", protect, async (req, res) => {
  try {
    const payment = await Payment.findOne({ transactionRef: req.params.ref });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });
    res.json({ status: payment.status, transactionRef: payment.transactionRef, amount: payment.amount, service: payment.service, interswitchRef: payment.interswitchRef });
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
