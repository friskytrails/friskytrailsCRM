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

    let reporterName = req.user.name;
    let reporterEmail = req.user.email;
    if (!reporterName || !reporterEmail) {
      const User = require('../models/User');
      const userDoc = await User.Model.findById(req.user.userId || req.user.id || req.user._id);
      if (userDoc) {
        reporterName = reporterName || userDoc.name || 'Anonymous Agent';
        reporterEmail = reporterEmail || userDoc.email || '';
      }
    }

    const newReport = new BugReport.Model({
      title: title.trim(),
      description: description.trim(),
      reportedBy: req.user.userId || req.user.id || req.user._id,
      reporterName: reporterName || 'Anonymous Agent',
      reporterEmail: reporterEmail || ''
    });

    await newReport.save();
    res.status(201).json(BugReport.formatDoc(newReport));
  } catch (error) {
    console.error("Error creating bug report:", error);
    res.status(500).json({ error: error.message || "Failed to submit bug report" });
  }
}

async function updateBugStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }
    const report = await BugReport.Model.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!report) {
      return res.status(404).json({ error: "Bug report not found" });
    }
    res.json(BugReport.formatDoc(report));
  } catch (error) {
    console.error("Error updating bug status:", error);
    res.status(500).json({ error: "Failed to update bug status" });
  }
}

module.exports = {
  getBugReports,
  createBugReport,
  updateBugStatus
};
