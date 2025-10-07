const express = require('express');
const router = express.Router();
const StateController = require('../../app/controller/state');

// All-in-one page
router.get('/', StateController.renderPage);

// Create new state
router.post('/add', StateController.createStates);

// Update state
router.post('/update', StateController.updateState);

// Delete state
router.get('/delete/:id', StateController.deleteState);

module.exports = router;
