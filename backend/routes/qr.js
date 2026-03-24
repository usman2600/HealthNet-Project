const router = require("express").Router();
const QRCode = require("qrcode");
const CryptoJS = require("crypto-js");
const Patient = require("../models/Patient");
const Visit = require("../models/Visit");
const { protect } = require("../middleware/auth");

const SECRET = () => process.env.AES_SECRET;

router.use(protect);

// Generate encrypted QR for a patient
router.get("/generate/:patientId", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const visits = await Visit.find({ patient: req.params.patientId }).sort({ createdAt: -1 }).limit(5).lean();

    const payload = JSON.stringify({ patient, visits, generatedAt: new Date().toISOString() });
    const encrypted = CryptoJS.AES.encrypt(payload, SECRET()).toString();

    const qrDataURL = await QRCode.toDataURL(encrypted, { errorCorrectionLevel: "M", width: 300 });
    res.json({ qr: qrDataURL, encrypted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Decrypt a scanned QR payload
router.post("/decode", async (req, res) => {
  try {
    const { encrypted } = req.body;
    if (!encrypted) return res.status(400).json({ message: "No payload provided" });

    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return res.status(400).json({ message: "Invalid or tampered QR payload" });

    res.json(JSON.parse(decrypted));
  } catch {
    res.status(400).json({ message: "Failed to decode QR payload" });
  }
});

module.exports = router;
