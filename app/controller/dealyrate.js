const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require('xlsx');
const rajya = require('../models/state');
const sabjiMandi = require('../models/mandi');
const itemCommodity = require('../models/commodity');
const SabjiMandirate = require('../models/mandirate');

class MandiRateController {
  async list(req, res) {
    try {
      const states = await rajya.find().sort('name');
      const commodities = await itemCommodity.find().sort('name');
      res.render('mandirate', { states, commodities });
    } catch (err) {
      console.error('Error in list:', err);
      res.status(500).json({ error: 'Failed to load mandi rate form' });
    }
  }
 getMandis = async (req, res) => {
  console.log('Fetching mandis for state:', req.params.state);
  try {
    const mandis = await sabjiMandi.find({ state: req.params.state }).select('_id name').lean();
    console.log('Mandis found:', JSON.stringify(mandis, null, 2));
    if (!mandis.length) {
      console.warn('No mandis found for state:', req.params.state);
      return res.status(200).json([]);
    }
    res.json(mandis.map(m => ({ id: m._id, name: m.name })));
  } catch (error) {
    console.error('Error fetching mandis:', error);
    res.status(500).json({ error: 'Failed to fetch mandis' });
  }
};

  async search(req, res) {
    try {
      const { state, mandi, search } = req.query;
      const query = {};
      if (state) query.state = state;
      if (mandi) query.mandi = { $regex: mandi, $options: 'i' };
      const rates = await SabjiMandirate.find(query).populate('state');
      const rows = [];
      rates.forEach(rate => {
        rate.list.forEach(item => {
          const lastPrice = item.prices[item.prices.length - 1] || {};
          const secondLastPrice = item.prices[item.prices.length - 2] || {};
          const difference = lastPrice.maxrate ? (lastPrice.maxrate - (secondLastPrice.maxrate || lastPrice.maxrate)) : 0;
          if (!search ||
              rate.state.name.toLowerCase().includes(search.toLowerCase()) ||
              rate.mandi.toLowerCase().includes(search.toLowerCase()) ||
              item.commodity.toLowerCase().includes(search.toLowerCase())) {
            rows.push({
              stateId: rate.state._id,
              stateName: rate.state.name,
              mandi: rate.mandi,
              commodity: item.commodity,
              type: item.type,
              minrate: lastPrice.minrate || 0,
              maxrate: lastPrice.maxrate || 0,
              arrival: lastPrice.arrival || 0,
              updated: lastPrice.date ? new Date(lastPrice.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
              difference,
              mandirateid: rate._id
            });
          }
        });
      });
      res.json(rows);
    } catch (err) {
      console.error('Error in search:', err);
      res.status(500).json({ error: 'Failed to search mandi rates' });
    }
  }

add = async (req, res) => {
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));
  try {
    if (!req.body) {
      console.error('Request body is undefined');
      return res.status(400).json({ error: 'Request body is missing' });
    }

    let { state, mandi, types, commodity_ids, minrates, maxrates, arrivals } = req.body;

    // Normalize arrays
    types = Array.isArray(types) ? types : (typeof types === 'string' ? [types] : []);
    commodity_ids = Array.isArray(commodity_ids) ? commodity_ids : (typeof commodity_ids === 'string' ? [commodity_ids] : []);
    minrates = Array.isArray(minrates) ? minrates : (typeof minrates === 'string' ? [minrates] : []);
    maxrates = Array.isArray(maxrates) ? maxrates : (typeof maxrates === 'string' ? [maxrates] : []);
    arrivals = Array.isArray(arrivals) ? arrivals : (typeof arrivals === 'string' ? [arrivals] : []);

    console.log('Normalized request body:', { state, mandi, types, commodity_ids, minrates, maxrates, arrivals });

    // Validate required fields
    if (!state || !mandi || !types.length || !commodity_ids.length || !minrates.length || !maxrates.length) {
      console.error('Request body is missing required fields:', { state, mandi, types, commodity_ids, minrates, maxrates, arrivals });
      return res.status(400).json({ error: 'Missing required fields', details: { state, mandi, types, commodity_ids, minrates, maxrates, arrivals } });
    }

    // Validate array lengths
    if (types.length !== commodity_ids.length || types.length !== minrates.length || types.length !== maxrates.length || (arrivals.length && arrivals.length !== types.length)) {
      console.error('Array length mismatch:', { types: types.length, commodity_ids: commodity_ids.length, minrates: minrates.length, maxrates: maxrates.length, arrivals: arrivals.length });
      return res.status(400).json({ error: 'Array length mismatch' });
    }

    // Validate state and mandi
    const stateExists = await rajya.findById(state);
    if (!stateExists) {
      console.error('Invalid state ID:', state);
      return res.status(400).json({ error: 'Invalid state ID' });
    }

    const mandiExists = await sabjiMandi.findOne({ state, name: mandi });
    if (!mandiExists) {
      console.error('Invalid mandi:', mandi);
      return res.status(400).json({ error: 'Invalid mandi name' });
    }

    // Process each commodity
    let mandiRate = await SabjiMandirate.findOne({ state, mandi });
    if (!mandiRate) {
      mandiRate = new SabjiMandirate({ state, mandi, list: [], latest_trend: 0 });
    }

    for (let i = 0; i < commodity_ids.length; i++) {
      const commodityName = commodity_ids[i];
      const type = types[i];
      const minrate = parseFloat(minrates[i]);
      const maxrate = parseFloat(maxrates[i]);
      const arrival = arrivals[i] ? parseFloat(arrivals[i]) : null;

      if (isNaN(minrate) || isNaN(maxrate) || minrate < 0 || maxrate < 0 || (arrival !== null && (isNaN(arrival) || arrival < 0))) {
        console.error('Invalid numeric values:', { minrate, maxrate, arrival });
        return res.status(400).json({ error: 'Invalid numeric values for prices or arrivals' });
      }

      const commodityEntry = mandiRate.list.find(c => c.commodity.toLowerCase() === commodityName.toLowerCase());
      if (commodityEntry) {
        const lastPrice = commodityEntry.prices[commodityEntry.prices.length - 1] || { minrate: 0 };
        const trend = minrate > lastPrice.minrate ? 1 : minrate < lastPrice.minrate ? -1 : 0;
        commodityEntry.prices.push({ minrate, maxrate, arrival, date: new Date(), trend });
        commodityEntry.type = type;
      } else {
        mandiRate.list.push({
          commodity: commodityName,
          type,
          prices: [{ minrate, maxrate, arrival, date: new Date(), trend: 0 }]
        });
      }
    }

    // Recalculate latest_trend
    mandiRate.latest_trend = mandiRate.list.reduce((sum, c) => {
      const latestPrice = c.prices[c.prices.length - 1];
      return sum + (latestPrice?.trend || 0);
    }, 0);

    await mandiRate.save();
    res.redirect('/mandi-rates');
  } catch (error) {
    console.error('Error in add:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// getMandis = async (req, res) => {
//   console.log('Fetching mandis for state:', req.params.state);
//   try {
//     const mandis = await SabjiMandi.find({ state: req.params.state }).select('_id name').lean();
//     console.log('Mandis found:', JSON.stringify(mandis, null, 2));
//     if (!mandis.length) {
//       console.warn('No mandis found for state:', req.params.state);
//       return res.status(200).json([]);
//     }
//     res.json(mandis.map(m => ({ id: m._id, name: m.name })));
//   } catch (error) {
//     console.error('Error fetching mandis:', error);
//     res.status(500).json({ error: 'Failed to fetch mandis' });
//   }
// };

  async addPriceToCommodity(req, res) {
    try {
      const { id, commodity } = req.params;
      const { minrate, maxrate, arrival } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid mandi rate ID' });
      }
      if (!commodity || !commodity.trim()) {
        return res.status(400).json({ error: 'Commodity is required' });
      }
      if (minrate == null || maxrate == null || isNaN(Number(minrate)) || isNaN(Number(maxrate)) || Number(minrate) < 0 || Number(maxrate) < 0) {
        return res.status(400).json({ error: 'Valid minrate and maxrate are required' });
      }

      const rate = await SabjiMandirate.findById(id);
      if (!rate) return res.status(404).json({ error: 'Mandi rate record not found' });

      const index = rate.list.findIndex(l => l.commodity.toLowerCase() === commodity.toLowerCase());
      if (index === -1) return res.status(404).json({ error: 'Commodity not found in this mandi' });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const prices = rate.list[index].prices;
      const lastPrice = prices[prices.length - 1] || { maxrate: 0 };
      const trend = Number(maxrate) - Number(lastPrice.maxrate || 0);

      const todayIndex = prices.findIndex(p => p.date.getTime() === today.getTime());
      if (todayIndex > -1) {
        prices[todayIndex] = {
          minrate: Number(minrate),
          maxrate: Number(maxrate),
          arrival: Number(arrival) || 0,
          date: today,
          trend
        };
      } else {
        prices.push({
          minrate: Number(minrate),
          maxrate: Number(maxrate),
          arrival: Number(arrival) || 0,
          date: today,
          trend
        });
      }

      rate.latest_trend = trend;
      rate.updatedAt = new Date();
      await rate.save();

      res.json({ success: true, trend });
    } catch (err) {
      console.error('Error in addPriceToCommodity:', err);
      res.status(500).json({ error: 'Failed to add price' });
    }
  }

  async deleteCommodity(req, res) {
    try {
      const { id, commodity } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid mandi rate ID' });
      }
      if (!commodity || !commodity.trim()) {
        return res.status(400).json({ error: 'Commodity is required' });
      }
      const rate = await SabjiMandirate.findById(id);
      if (!rate) return res.status(404).json({ error: 'Mandi rate not found' });
      rate.list = rate.list.filter(l => l.commodity.toLowerCase() !== commodity.toLowerCase());
      if (rate.list.length === 0) {
        await SabjiMandirate.deleteOne({ _id: id });
      } else {
        rate.updatedAt = new Date();
        await rate.save();
      }
      res.redirect('/mandi-rates');
    } catch (err) {
      console.error('Error in deleteCommodity:', err);
      res.status(500).json({ error: 'Failed to delete commodity' });
    }
  }

  async getHistory(req, res) {
    try {
      const { id, commodity } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid mandi rate ID' });
      }
      if (!commodity || !commodity.trim()) {
        return res.status(400).json({ error: 'Commodity is required' });
      }
      const rate = await SabjiMandirate.findById(id).populate('state');
      if (!rate) return res.status(404).json({ error: 'Mandi rate not found' });
      const item = rate.list.find(l => l.commodity.toLowerCase() === commodity.toLowerCase());
      if (!item) return res.status(404).json({ error: 'Commodity not found' });
      res.json({
        state: rate.state.name,
        mandi: rate.mandi,
        commodity: item.commodity,
        prices: item.prices.sort((a, b) => a.date - b.date).map(p => ({
          date: new Date(p.date).toISOString(),
          minrate: p.minrate,
          maxrate: p.maxrate,
          arrival: p.arrival,
          trend: p.trend
        }))
      });
    } catch (err) {
      console.error('Error in getHistory:', err);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  async exportCSV(req, res) {
    try {
      const { state, mandi, search } = req.query;
      const query = {};
      if (state) query.state = state;
      if (mandi) query.mandi = { $regex: mandi, $options: 'i' };
      const rates = await SabjiMandirate.find(query).populate('state');
      const records = [];
      rates.forEach(rate => {
        rate.list.forEach(item => {
          const lastPrice = item.prices[item.prices.length - 1];
          if (!search ||
              rate.state.name.toLowerCase().includes(search.toLowerCase()) ||
              rate.mandi.toLowerCase().includes(search.toLowerCase()) ||
              item.commodity.toLowerCase().includes(search.toLowerCase())) {
            records.push({
              state: rate.state.name,
              mandi: rate.mandi,
              commodity: item.commodity,
              type: item.type,
              min: lastPrice.minrate,
              max: lastPrice.maxrate,
              arrival: lastPrice.arrival,
              date: new Date(lastPrice.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
          }
        });
      });
      const csvWriter = createCsvWriter({
        path: 'mandirates.csv',
        header: [
          { id: 'state', title: 'State' },
          { id: 'mandi', title: 'Mandi' },
          { id: 'type', title: 'Type' },
          { id: 'commodity', title: 'Commodity' },
          { id: 'min', title: 'Min Price' },
          { id: 'max', title: 'Max Price' },
          { id: 'arrival', title: 'Est. Qty' },
          { id: 'date', title: 'Last Updated' }
        ]
      });
      await csvWriter.writeRecords(records);
      res.download('mandirates.csv', () => fs.unlinkSync('mandirates.csv'));
    } catch (err) {
      console.error('Error in exportCSV:', err);
      res.status(500).json({ error: 'Failed to export CSV' });
    }
  }

  async exportExcel(req, res) {
    try {
      const { state, mandi, search } = req.query;
      const query = {};
      if (state) query.state = state;
      if (mandi) query.mandi = { $regex: mandi, $options: 'i' };
      const rates = await SabjiMandirate.find(query).populate('state');
      const records = [];
      rates.forEach(rate => {
        rate.list.forEach(item => {
          const lastPrice = item.prices[item.prices.length - 1];
          if (!search ||
              rate.state.name.toLowerCase().includes(search.toLowerCase()) ||
              rate.mandi.toLowerCase().includes(search.toLowerCase()) ||
              item.commodity.toLowerCase().includes(search.toLowerCase())) {
            records.push({
              State: rate.state.name,
              Mandi: rate.mandi,
              Type: item.type,
              Commodity: item.commodity,
              'Min Price': lastPrice.minrate,
              'Max Price': lastPrice.maxrate,
              'Est. Qty': lastPrice.arrival,
              'Last Updated': new Date(lastPrice.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
          }
        });
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(records);
      XLSX.utils.book_append_sheet(wb, ws, 'MandiRates');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=mandirates.xlsx');
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    } catch (err) {
      console.error('Error in exportExcel:', err);
      res.status(500).json({ error: 'Failed to export Excel' });
    }
  }

  async report(req, res) {
    try {
      const { days } = req.query;
      const threshold = days ? new Date(Date.now() - days * 86400000) : new Date(0);
      const rates = await SabjiMandirate.find({ updatedAt: { $gte: threshold } }).populate('state');
      const data = [];
      rates.forEach(rate => {
        rate.list.forEach(item => {
          item.prices.filter(p => p.date >= threshold).forEach(p => {
            data.push({
              stateName: rate.state.name,
              mandiName: rate.mandi,
              address: `${rate.state.name} / ${rate.mandi}`,
              commodity: item.commodity,
              type: item.type,
              minimum: p.minrate,
              maximum: p.maxrate,
              estimatedArrival: p.arrival,
              lastUpdated: new Date(p.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
          });
        });
      });
      res.json(data);
    } catch (err) {
      console.error('Error in report:', err);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }
  
}

module.exports = new MandiRateController();