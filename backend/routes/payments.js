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

    await Payment.create({
      patient: patientId,
      amount: parseFloat(amount),
      service,
      transactionRef,
      processedBy: req.user._id,
      status: "pending",
    });

    // Interswitch Webpay hash: SHA512(clientId + transactionRef + amountInKobo)
    const hash = crypto
      .createHash("sha512")
      .update(`${CLIENT_ID}${transactionRef}${amountInKobo}`)
      .digest("hex");

    const redirectUrl = `https://healthnet-project-production.up.railway.app/api/payments/verify/${transactionRef}`;
    const custEmail = email || "patient@healthnet.ng";

    // Return a self-submitting HTML POST form — WebView loads this URL which auto-posts to Interswitch
    const formUrl = `https://healthnet-project-production.up.railway.app/api/payments/form/${transactionRef}`;

    // Store form data temporarily on the payment record so /form can render it
    await Payment.findOneAndUpdate(
      { transactionRef },
      { $set: { _formMeta: { amountInKobo, hash, redirectUrl, custEmail } } }
    );

    res.json({ transactionRef, formUrl });
  } catch (err) {
    console.error("Initiate error:", err.response?.data || err.message);
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

// GET /api/payments/form/:ref  — PUBLIC: serves self-submitting POST form to WebView
router.get("/form/:ref", async (req, res) => {
  try {
    const payment = await Payment.findOne({ transactionRef: req.params.ref }).lean();
    if (!payment) return res.status(404).send("Not found");

    const { amountInKobo, hash, redirectUrl, custEmail } = payment._formMeta || {};
    if (!amountInKobo) return res.status(400).send("Form data missing");

    const webpayUrl = `${BASE_URL}/webpay/pay`;

    res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0fdf4}
.box{text-align:center;padding:24px}.spinner{width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#16a34a;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}p{color:#6b7280;font-size:14px}</style></head>
<body><div class="box"><div class="spinner"></div><p>Connecting to Interswitch…</p></div>
<form id="f" method="POST" action="${webpayUrl}">
  <input type="hidden" name="merchantcode" value="${MERCHANT_CODE}" />
  <input type="hidden" name="payableCode" value="${PAYABLE_CODE}" />
  <input type="hidden" name="amount" value="${amountInKobo}" />
  <input type="hidden" name="txnref" value="${req.params.ref}" />
  <input type="hidden" name="currency" value="566" />
  <input type="hidden" name="cust_email" value="${custEmail}" />
  <input type="hidden" name="cust_id" value="${custEmail}" />
  <input type="hidden" name="hash" value="${hash}" />
  <input type="hidden" name="redirect_url" value="${redirectUrl}" />
  <input type="hidden" name="site_redirect_url" value="${redirectUrl}" />
</form>
<script>document.getElementById('f').submit();</script></body></html>`);
  } catch (err) {
    res.status(500).send("Error");
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
