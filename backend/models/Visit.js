const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    symptoms: [{ type: String }],
    diagnosis: { type: String },
    prescriptions: [
      {
        drug: String,
        dosage: String,
        frequency: String,
        duration: String,
      },
    ],
    labResults: [
      {
        test: String,
        result: String,
        unit: String,
        referenceRange: String,
      },
    ],
    notes: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    facility: { type: String },
    // Offline sync support
    localId: { type: String },
    lastModified: { type: Date, default: Date.now },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
