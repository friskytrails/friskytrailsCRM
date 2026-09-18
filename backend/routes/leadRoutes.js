const express = require('express');
const leadController = require('../controllers/leadController');
const webhookController = require('../controllers/webhookController');
const auth = require('../middleware/auth');
const webhookAuth = require('../middleware/webhookAuth');

const router = express.Router();

// Public webhook endpoints for Google Sheets / integrations (authenticated via x-api-key)
router.post('/webhook', webhookAuth, webhookController.handleLeadWebhook);
router.all('/webhook/test', webhookAuth, webhookController.testWebhook);

router.get('/', auth, leadController.getLeads);
router.get('/counts', auth, leadController.getLeadCounts);
router.post('/', auth, leadController.createLead);
router.get('/:id', auth, leadController.getLead);
router.put('/:id', auth, leadController.updateLead);
router.put('/:id/assign', auth, leadController.assignLead);
router.put('/:id/labels', auth, leadController.updateLabels);
router.put('/:id/dates', auth, leadController.updateDates);
router.put('/:id/reminder', auth, leadController.updateReminder);
router.put('/:id/status', auth, leadController.updateStatus);
router.put('/:id/book', auth, leadController.bookLead);
router.put('/:id/booking', auth, leadController.updateBooking);
router.post('/:id/notes', auth, leadController.addNote);
router.delete('/:id/notes/:noteId', auth, leadController.deleteNote);

module.exports = router;
