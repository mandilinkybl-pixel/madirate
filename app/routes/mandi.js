const express = require('express');
const router = express.Router();
const MandiController = require('../../app/controller/mandi');

// All-in-one page
router.get('/', MandiController.renderPage);

// Add new mandi
router.post('/add', MandiController.createMandis);

// Update mandi
router.post('/update', MandiController.updateMandi);

// Delete mandi
router.get('/delete/:id', MandiController.deleteMandi);

module.exports = router;
