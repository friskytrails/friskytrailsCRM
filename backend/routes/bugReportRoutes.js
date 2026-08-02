const express = require('express');
const bugReportController = require('../controllers/bugReportController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, bugReportController.getBugReports);
router.post('/', auth, bugReportController.createBugReport);

module.exports = router;
