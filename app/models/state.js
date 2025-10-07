const mongoose = require('mongoose');
const StateSchema = new mongoose.Schema({
    name: { type: String, required: true }
});

module.exports = mongoose.model('rajya', StateSchema);
