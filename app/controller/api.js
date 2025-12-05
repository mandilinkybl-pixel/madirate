const SabjiMandi = require('../models/mandi');
const Rajya = require('../models/state');
const SabjiMandirate = require('../models/mandirate');
const mongoose = require('mongoose');

// 1. Get All States
const getAllStates = async (req, res) => {
  try {
    const states = await Rajya.find().sort({ name: 1 }).select('name _id');
    res.json({
      success: true,
      count: states.length,
      data: states
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get All Mandis by State ID
const getMandisByState = async (req, res) => {
  try {
    const { stateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(stateId)) {
      return res.status(400).json({ success: false, message: "Invalid State ID" });
    }

    const mandis = await SabjiMandi.find({ state: stateId })
      .sort({ name: 1 })
      .select('name');

    res.json({
      success: true,
      stateId,
      count: mandis.length,
      mandis: mandis.map(m => m.name)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get All Commodities & Latest Prices for a Specific Mandi
const getMandiPrices = async (req, res) => {
  try {
    let { mandiName } = req.params;
    mandiName = decodeURIComponent(mandiName).trim();

    // Find latest rate document for this mandi
    const rateDoc = await SabjiMandirate.findOne({
      mandi: { $regex: `^${mandiName}$`, $options: 'i' }
    })
      .sort({ updatedAt: -1 })
      .populate('state', 'name');

    if (!rateDoc) {
      return res.status(404).json({
        success: false,
        message: `No price data found for mandi: ${mandiName}`
      });
    }

    const todayIST = new Date();
    todayIST.setUTCHours(0, 0, 0, 0);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date(todayIST.getTime() + istOffset);
    today.setHours(0, 0, 0, 0);

    const commodities = [];

    for (const item of rateDoc.list) {
      // Get the latest price entry
      const latestPrice = item.prices
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      if (!latestPrice) continue;

      const isToday = new Date(latestPrice.date).toDateString() === today.toDateString();

      commodities.push({
        commodity: item.commodity,
        type: item.type,
        min_price: latestPrice.minrate || 0,
        max_price: latestPrice.maxrate || 0,
        arrival: latestPrice.arrival || 0,
        trend: latestPrice.trend || 0,
        date: latestPrice.date,
        isToday: isToday
      });
    }

    // Sort by commodity name
    commodities.sort((a, b) => a.commodity.localeCompare(b.commodity));

    res.json({
      success: true,
      mandi: rateDoc.mandi,
      state: rateDoc.state?.name || "Unknown",
      lastUpdated: rateDoc.updatedAt,
      totalCommodities: commodities.length,
      prices: commodities
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get ALL Mandis + ALL Latest Commodity Prices in a State (Dashboard View)
const getAllMandiPricesInState = async (req, res) => {
  try {
    const { stateId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(stateId)) {
      return res.status(400).json({ success: false, message: "Invalid State ID" });
    }

    const state = await Rajya.findById(stateId).select('name');
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }

    // Get all mandis in this state
    const mandis = await SabjiMandi.find({ state: stateId }).select('name');

    const result = {
      success: true,
      state: state.name,
      totalMandis: mandis.length,
      lastUpdated: new Date(),
      mandis: []
    };

    // For each mandi, get latest prices
    for (const mandi of mandis) {
      const latestDoc = await SabjiMandirate.findOne({ mandi: mandi.name })
        .sort({ updatedAt: -1 });

      const commodities = [];

      if (latestDoc) {
        for (const item of latestDoc.list) {
          const price = item.prices.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          if (price) {
            commodities.push({
              commodity: item.commodity,
              type: item.type || "N/A",
              min: price.minrate || 0,
              max: price.maxrate || 0,
              arrival: price.arrival || 0,
              trend: price.trend || 0
            });
          }
        }
      }

      result.mandis.push({
        mandiName: mandi.name,
        totalCommodities: commodities.length,
        lastUpdated: latestDoc?.updatedAt || null,
        commodities
      });
    }

    // Sort mandis alphabetically
    result.mandis.sort((a, b) => a.mandiName.localeCompare(b.mandiName));

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllStates,
  getMandisByState,
  getMandiPrices,
  getAllMandiPricesInState
};