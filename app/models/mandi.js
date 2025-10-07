const mongoose = require('mongoose');

const mandi = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'rajya', required: true  }
});

module.exports = mongoose.model('sabjiMandi', mandi);
