require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: "Too many requests" }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/visits", require("./routes/visits"));
app.use("/api/qr", require("./routes/qr"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/payments", require("./routes/payments"));

app.get("/health", (_, res) => res.json({ status: "ok", service: "HealthNet API" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`HealthNet API running on port ${PORT}`)))
  .catch((err) => { console.error("DB connection failed:", err); process.exit(1); });
