const router = require("express").Router();
const { protect } = require("../middleware/auth");

const SAFETY_DISCLAIMER = "\n\n⚠️ For informational purposes only. Please consult a qualified healthcare provider for medical advice.";

const SYSTEM_PROMPT = `You are a health literacy assistant helping patients in rural Nigeria understand their medical information.
Translate medical terms, prescriptions, and lab results into simple, clear language a non-medical person can understand.
Be concise, warm, and avoid technical jargon. Always respond in plain English.
Never provide diagnoses or treatment recommendations beyond what is already prescribed.`;

router.use(protect);

router.post("/explain", async (req, res) => {
  try {
    const { text, type } = req.body; // type: "prescription" | "lab_result" | "diagnosis"
    if (!text) return res.status(400).json({ message: "No text provided" });

    const prompt = `${SYSTEM_PROMPT}\n\nPlease explain the following ${type || "medical information"} in simple terms:\n\n${text}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `Gemini API error (${response.status})`;
      console.error("Gemini error:", errMsg);
      throw new Error(errMsg);
    }

    const data = await response.json();
    const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!explanation) throw new Error("No explanation generated");

    res.json({ explanation: explanation + SAFETY_DISCLAIMER });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
