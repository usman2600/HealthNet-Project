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

// Fetch Interswitch OAuth2 access token
async function getAccessToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const { data } = await axios.post(
    `${BASE_URL}/passport/oauth/token`,
    "grant_type=client_credentials&scope=profile",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return data.access_token;
}

// POST /api/payments/initiate  (protected)
router.post("/initiate", protect, async (req, res) => {
  try {
    const { patientId, amount, service, email } = req.body;
    if (!patientId || !amount || !service)
      return res.status(400).json({ message: "patientId, amount and service are required" });

    const transactionRef = generateRef();
    const amountInKobo = Math.round(parseFloat(amount) * 100);

    const payment = await Payment.create({
      patient: patientId,
      amount: parseFloat(amount),
      service,
      transactionRef,
      processedBy: req.user._id,
      status: "pending",
    });

    // Interswitch Webpay hash: SHA512(clientId + transactionRef + amountInKobo)
    const hashInput = `${CLIENT_ID}${transactionRef}${amountInKobo}`;
    const hash = crypto.createHash("sha512").update(hashInput).digest("hex");

    const redirectUrl = `https://healthnet-project-production.up.railway.app/api/payments/verify/${transactionRef}`;

    const params = new URLSearchParams({
      merchantcode: MERCHANT_CODE,
      payableCode: PAYABLE_CODE,
      amount: amountInKobo.toString(),
      txnref: transactionRef,
      currency: "566",
      cust_email: email || "patient@healthnet.ng",
      cust_id: email || "patient@healthnet.ng",
      hash,
      redirect_url: redirectUrl,
      site_redirect_url: redirectUrl,
    });

    // Interswitch Webpay sandbox checkout
    const paymentUrl = `${BASE_URL}/webpay/pay?${params.toString()}`;

    res.json({ transactionRef, payment, paymentUrl });
  } catch (err) {
    console.error("Initiate error:", err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// GET /api/payments/verify/:ref  — PUBLIC: WebView navigates here after Interswitch redirect
router.get("/verify/:ref", async (req, res) => {
  try {
    const payment = await Payment.findOne({ transactionRef: req.params.ref });
    if (!payment) return res.status(404).send("Transaction not found");

    const token = await getAccessToken();
    const { data } = await axios.get(
      `${BASE_URL}/collections/api/v1/gettransaction.json?merchantcode=${MERCHANT_CODE}&transactionreference=${req.params.ref}&amount=${Math.round(payment.amount * 100)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    payment.status = data.ResponseCode === "00" ? "success" : "failed";
    payment.interswitchRef = data.TransactionReference || null;
    await payment.save();

    // Return HTML so WebView detects the URL change and app handles the rest
    res.send(`<html><body><h2>Payment ${payment.status}. Return to the app.</h2></body></html>`);
  } catch (err) {
    console.error("Verify error:", err.response?.data || err.message);
    res.status(500).send("Verification failed");
  }
});

// GET /api/payments/status/:ref  — protected, app polls this after WebView closes
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

// GET /api/payments/patient/:patientId  (protected)
router.get("/patient/:patientId", protect, async (req, res) => {
  try {
    const payments = await Payment.find({ patient: req.params.patientId }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
