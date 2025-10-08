const express = require('express');
const router = express.Router();
const CommodityController = require('../../app/controller/commodity');

// Render commodity page
router.get('/', CommodityController.renderPage);

// Add multiple commodities
router.post('/add', CommodityController.addCommodities);

// Autocomplete for frontend
router.get('/autocomplete', CommodityController.getAll);

// Delete commodity
router.get('/delete/:id', CommodityController.deleteCommodity);


module.exports = router;
