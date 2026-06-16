const express = require('express');
const leadController = require('../controllers/leadController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, leadController.getLeads);
router.post('/', auth, leadController.createLead);
router.get('/:id', auth, leadController.getLead);
router.put('/:id', auth, leadController.updateLead);
router.put('/:id/assign', auth, leadController.assignLead);
router.put('/:id/labels', auth, leadController.updateLabels);
router.put('/:id/dates', auth, leadController.updateDates);
router.put('/:id/status', auth, leadController.updateStatus);
router.put('/:id/booking', auth, leadController.updateBooking);
router.post('/:id/notes', auth, leadController.addNote);
router.delete('/:id/notes/:noteId', auth, leadController.deleteNote);

module.exports = router;
