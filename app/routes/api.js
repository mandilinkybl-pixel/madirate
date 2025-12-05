const express = require('express');
const router = express.Router();
const {
  getAllStates,
  getMandisByState,
  getMandiPrices,
  getAllMandiPricesInState
} = require('../controller/api');

// 1. Get all states
router.get('/states', getAllStates);

// 2. Get mandis by state
router.get('/states/:stateId/mandis', getMandisByState);

// 3. Get prices of one mandi
router.get('/mandi/:mandiName/prices', getMandiPrices);

// 4. Get ALL mandis + prices in a state (Best for homepage)
router.get('/state/:stateId/all-prices', getAllMandiPricesInState);

module.exports = router;