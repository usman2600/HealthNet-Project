const router = require("express").Router();
const Visit = require("../models/Visit");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/", async (req, res) => {
  try {
    const visit = await Visit.create({ ...req.body, recordedBy: req.user._id });
    res.status(201).json(visit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/patient/:patientId", async (req, res) => {
  try {
    const visits = await Visit.find({ patient: req.params.patientId }).sort({ createdAt: -1 });
    res.json(visits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id).populate("patient", "name age gender");
    if (!visit) return res.status(404).json({ message: "Visit not found" });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk sync for offline visits
router.post("/sync", async (req, res) => {
  try {
    const { records } = req.body;
    const results = await Promise.all(
      records.map(async (record) => {
        if (record._id) {
          const updated = await Visit.findByIdAndUpdate(record._id, { ...record, syncedAt: new Date() }, { new: true, upsert: false });
          return { localId: record.localId, status: "updated", record: updated };
        }
        const created = await Visit.create({ ...record, recordedBy: req.user._id, syncedAt: new Date() });
        return { localId: record.localId, status: "created", record: created };
      })
    );
    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
