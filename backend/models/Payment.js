const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    service: { type: String, required: true },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    transactionRef: { type: String, unique: true },
    interswitchRef: { type: String },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Local log for offline verification
    localId: { type: String },
    lastModified: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
