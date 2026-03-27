const router = require("express").Router();
const crypto = require("crypto");
const axios = require("axios");
const Payment = require("../models/Payment");
const { protect } = require("../middleware/auth");

const BASE_URL = process.env.INTERSWITCH_BASE_URL;
const CLIENT_ID = process.env.INTERSWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.INTERSWITCH_CLIENT_SECRET;
const PAYABLE_CODE = "Default_Payable_MX26070";
const MERCHANT_CODE = "MX26070";

const generateRef = () =>
  `HN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

/**
 * Interswitch MAC Auth header
 * Format: InterswitchAuth <base64(clientId:timestamp:nonce:mac)>
 * MAC = HMAC-SHA256(clientId + timestamp + nonce + httpMethod + resourcePath + bodyHash, clientSecret)
 */
function buildAuthHeader(method, resourcePath, body = "") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const bodyHash = body
    ? crypto.createHash("sha512").update(body).digest("base64")
    : "";

  const signatureString = [CLIENT_ID, timestamp, nonce, method.toUpperCase(), resourcePath, bodyHash]
    .join("&");

  const mac = crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(signatureString)
    .digest("base64");

  const token = Buffer.from(`${CLIENT_ID}:${timestamp}:${nonce}:${mac}`).toString("base64");
  return `InterswitchAuth ${token}`;
}

// GET /api/payments/debug — test Interswitch connectivity and auth
router.get("/debug", protect, async (req, res) => {
  try {
    const resourcePath = "/api/v2/purchases";
    const bodyObj = { test: true };
    const bodyStr = JSON.stringify(bodyObj);
    const authHeader = buildAuthHeader("POST", resourcePath, bodyStr);

    // Just test auth header generation and connectivity
    let interswitchReachable = false;
    let interswitchResponse = null;
    try {
      const r = await axios.post(`${BASE_URL}${resourcePath}`, bodyObj, {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        timeout: 10000,
      });
      interswitchReachable = true;
      interswitchResponse = r.data;
    } catch (e) {
      interswitchReachable = e.response ? true : false;
      interswitchResponse = e.response?.data || e.message;
    }

    res.json({
      BASE_URL,
      CLIENT_ID: CLIENT_ID?.slice(0, 8) + "...",
      authHeaderPreview: authHeader.slice(0, 40) + "...",
      interswitchReachable,
      interswitchResponse,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/confirm — called by app after SDK onCompleted
router.post("/confirm", protect, async (req, res) => {
  try {
    const { transactionRef, responseCode, interswitchRef } = req.body;
    const payment = await Payment.findOne({ transactionRef });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });
    payment.status = responseCode === "00" ? "success" : "failed";
    if (interswitchRef) payment.interswitchRef = interswitchRef;
    await payment.save();
    res.json({ status: payment.status, transactionRef });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/initiate — create pending record
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

// POST /api/payments/pay — charge card via Interswitch Direct Pay
router.post("/pay", protect, async (req, res) => {
  try {
    const { transactionRef, pan, expiry, cvv, pin } = req.body;
    if (!transactionRef || !pan || !expiry || !cvv)
      return res.status(400).json({ message: "Card details incomplete" });

    const payment = await Payment.findOne({ transactionRef });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });

    const amountInKobo = Math.round(payment.amount * 100);
    const resourcePath = "/api/v2/purchases";

    const bodyObj = {
      customerId: payment._id.toString(),
      amount: amountInKobo,
      transactionRef,
      currency: "NGN",
      description: payment.service,
      cardNumber: pan.replace(/\s/g, ""),
      cardExpiry: expiry.replace("/", ""), // MMYY
      cardCvv: cvv,
      cardPin: pin || "",
      merchantCode: MERCHANT_CODE,
      payableCode: PAYABLE_CODE,
    };

    const bodyStr = JSON.stringify(bodyObj);
    const authHeader = buildAuthHeader("POST", resourcePath, bodyStr);

    const { data } = await axios.post(`${BASE_URL}${resourcePath}`, bodyObj, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    console.log("Interswitch pay response:", JSON.stringify(data));

    // OTP / 3DS required
    if (["T0", "S0", "00 T0"].includes(data.responseCode)) {
      payment.interswitchRef = data.otpTransactionIdentifier || data.transactionRef;
      await payment.save();
      return res.json({
        requiresOtp: true,
        message: data.message || "Enter the OTP sent to your registered phone.",
        otpRef: payment.interswitchRef,
      });
    }

    payment.status = data.responseCode === "00" ? "success" : "failed";
    payment.interswitchRef = data.transactionRef || null;
    await payment.save();

    res.json({
      status: payment.status,
      transactionRef,
      amount: payment.amount,
      service: payment.service,
      interswitchRef: payment.interswitchRef,
      responseCode: data.responseCode,
      responseDescription: data.responseDescription,
    });
  } catch (err) {
    console.error("Pay error:", err.response?.data || err.message);
    const msg = err.response?.data?.errors?.[0]?.defaultUserMessage
      || err.response?.data?.description
      || err.response?.data?.message
      || err.message;
    res.status(err.response?.status || 500).json({ message: msg });
  }
});

// POST /api/payments/otp — validate OTP
router.post("/otp", protect, async (req, res) => {
  try {
    const { transactionRef, otp } = req.body;
    const payment = await Payment.findOne({ transactionRef });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });

    const resourcePath = "/api/v2/purchases/otps/auths";
    const bodyObj = {
      otp,
      otpTransactionIdentifier: payment.interswitchRef,
      transactionRef,
    };
    const bodyStr = JSON.stringify(bodyObj);
    const authHeader = buildAuthHeader("POST", resourcePath, bodyStr);

    const { data } = await axios.post(`${BASE_URL}${resourcePath}`, bodyObj, {
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    console.log("Interswitch OTP response:", JSON.stringify(data));

    payment.status = data.responseCode === "00" ? "success" : "failed";
    await payment.save();

    res.json({
      status: payment.status,
      transactionRef,
      amount: payment.amount,
      service: payment.service,
      responseCode: data.responseCode,
    });
  } catch (err) {
    console.error("OTP error:", err.response?.data || err.message);
    const msg = err.response?.data?.description || err.response?.data?.message || err.message;
    res.status(err.response?.status || 500).json({ message: msg });
  }
});

// GET /api/payments/status/:ref
router.get("/status/:ref", protect, async (req, res) => {
  try {
    const payment = await Payment.findOne({ transactionRef: req.params.ref });
    if (!payment) return res.status(404).json({ message: "Transaction not found" });
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
