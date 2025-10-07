const express = require('express');
const router = express.Router();
const mandirateController = require('../../app/controller/dealyrate');

router.get('/', mandirateController.list);
router.get('/mandis/:state', mandirateController.getMandis);
router.get('/search', mandirateController.search);
router.post('/add', mandirateController.add);
router.post('/add-price/:id/:commodity', mandirateController.addPriceToCommodity);
router.post('/delete-commodity/:id/:commodity', mandirateController.deleteCommodity);
router.get('/export/csv', mandirateController.exportCSV);
router.get('/export/excel', mandirateController.exportExcel);
router.get('/report', mandirateController.report);
router.get('/history/:id/:commodity', mandirateController.getHistory);



module.exports = router;
