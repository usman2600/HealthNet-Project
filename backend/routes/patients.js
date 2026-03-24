const router = require("express").Router();
const Patient = require("../models/Patient");
const { protect } = require("../middleware/auth");

// FHIR-style response wrapper
const toFHIR = (patient) => ({ resourceType: "Patient", id: patient._id, ...patient.toObject() });

router.use(protect);

router.post("/", async (req, res) => {
  try {
    const patient = await Patient.create({ ...req.body, registeredBy: req.user._id });
    res.status(201).json(toFHIR(patient));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = search ? { name: { $regex: search, $options: "i" } } : {};
    const patients = await Patient.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ lastModified: -1 });
    res.json({ resourceType: "Bundle", total: patients.length, entry: patients.map(toFHIR) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json(toFHIR(patient));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    // Last-Write-Wins conflict resolution via lastModified timestamp
    const incoming = new Date(req.body.lastModified || Date.now());
    const existing = await Patient.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Patient not found" });

    if (existing.lastModified > incoming)
      return res.status(409).json({ message: "Conflict: server has newer data", serverRecord: toFHIR(existing) });

    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModified: new Date() },
      { new: true, runValidators: true }
    );
    res.json(toFHIR(updated));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Bulk sync endpoint for offline-first support
router.post("/sync", async (req, res) => {
  try {
    const { records } = req.body; // array of patient objects with localId
    const results = await Promise.all(
      records.map(async (record) => {
        if (record._id) {
          const existing = await Patient.findById(record._id);
          if (existing && existing.lastModified > new Date(record.lastModified))
            return { localId: record.localId, status: "conflict", serverRecord: toFHIR(existing) };
          return { localId: record.localId, status: "updated", record: toFHIR(await Patient.findByIdAndUpdate(record._id, { ...record, syncedAt: new Date() }, { new: true })) };
        }
        const created = await Patient.create({ ...record, registeredBy: req.user._id, syncedAt: new Date() });
        return { localId: record.localId, status: "created", record: toFHIR(created) };
      })
    );
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
