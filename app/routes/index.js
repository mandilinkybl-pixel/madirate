const express = require('express');
const app = express.Router();





app.use('/states', require('./states'));
app.use('/mandi', require('./mandi'));
app.use('/commodities', require('./commodity'));
app.use('/mandi-rates', require('./dealyrate'));
app.use('/auth', require('./auth'));


module.exports = app;