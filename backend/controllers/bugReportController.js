const BugReport = require('../models/BugReport');

async function getBugReports(req, res) {
  try {
    const reports = await BugReport.Model.find({}).sort({ createdAt: -1 });
    const formattedReports = reports.map(r => BugReport.formatDoc(r));
    res.json(formattedReports);
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    res.status(500).json({ error: "Failed to fetch bug reports" });
  }
}

async function createBugReport(req, res) {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Bug title is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Bug description is required" });
    }

    const newReport = new BugReport.Model({
      title: title.trim(),
      description: description.trim(),
      reportedBy: req.user.userId || req.user.id || req.user._id,
      reporterName: req.user.name || 'Anonymous Agent',
      reporterEmail: req.user.email || ''
    });

    await newReport.save();
    res.status(201).json(BugReport.formatDoc(newReport));
  } catch (error) {
    console.error("Error creating bug report:", error);
    res.status(500).json({ error: error.message || "Failed to submit bug report" });
  }
}

module.exports = {
  getBugReports,
  createBugReport
};
