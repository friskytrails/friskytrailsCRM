const express = require('express');
const configController = require('../controllers/configController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, configController.getConfig);
router.put('/products', auth, configController.updateProducts);

module.exports = router;
