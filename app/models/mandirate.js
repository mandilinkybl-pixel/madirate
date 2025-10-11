const mongoose = require("mongoose");

const PriceSchema = new mongoose.Schema({
  minrate: { type: Number, min: 0 },
  maxrate: { type: Number, min: 0 },
  arrival: { type: Number, default: 0, min: 0 },
  trend: { type: Number, default: 0 },
  date: {
    type: Date,
    
    default: () => {
      const now = new Date();
      // Ensure date-only in IST (00:00:00)
      const istNow = new Date(now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
      istNow.setHours(0, 0, 0, 0);
      return istNow;
    },
  },
});

// Sub-schema for each commodity
const CommodityListSchema = new mongoose.Schema({
  commodity: { type: String,  trim: true },
  type: { type: String,  enum:["Combine","Hath","Other","N/A"] , default: "N/A", trim: true },
  prices: {
    type: [PriceSchema],
    
    validate: [v => v.length > 0, "At least one price is required"],
  },
});

// Main Mandi schema
const MandirateSchema = new mongoose.Schema(
  {
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rajya",
      
    },
    mandi: { type: String,  trim: true },
    list: {
      type: [CommodityListSchema],
      
      validate: [v => v.length > 0, "At least one commodity is required"],
    },
    latest_trend: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique index
MandirateSchema.index({ state: 1, mandi: 1, type: 1 }, { unique: true });

// Prevent duplicate price dates per commodity
MandirateSchema.pre("save", function (next) {
  for (const commodity of this.list) {
    const dates = commodity.prices.map(p => p.date.getTime());
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      return next(new Error(`Duplicate date entries found for ${commodity.commodity}`));
    }
  }
  next();
});

module.exports = mongoose.model("SabjiMandirate", MandirateSchema);