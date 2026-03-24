const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    // FHIR R4 aligned
    resourceType: { type: String, default: "Patient" },
    fhirId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    phone: { type: String },
    address: { type: String },
    allergies: [{ type: String }],
    medicalHistory: [
      {
        condition: String,
        diagnosedAt: Date,
        notes: String,
      },
    ],
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Offline sync support
    localId: { type: String },
    lastModified: { type: Date, default: Date.now },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
