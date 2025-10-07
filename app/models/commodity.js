const mongoose = require('mongoose');

const CommoditySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

// Unique index with case-insensitive enforcement
CommoditySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('itemCommodity', CommoditySchema);
