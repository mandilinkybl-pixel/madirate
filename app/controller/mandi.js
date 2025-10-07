const SabjiMandi = require('../models/mandi');
const rajya = require('../models/state');

class MandiController {
  // Render mandi page
  async renderPage(req, res) {
    try {
      const mandis = await SabjiMandi.find().populate('state').sort({ createdAt: -1 });
      const states = await rajya.find().sort({ name: 1 });
      const error = req.query.error || null;
      res.render('mandi', { mandis, states, error });
    } catch (err) {
      console.error('Error loading mandi page:', err);
      res.status(500).send('Error loading mandi page');
    }
  }

  // Add multiple mandis for a single state
  async createMandis(req, res) {
    try {
      const { state, mandis } = req.body; // state: stateId, mandis: [{ name }]
      if (!state || !mandis) {
        return res.redirect('/mandi?error=Please select a state and add mandi names');
      }

      // Normalize mandis to array (if only one input)
      let mandiList = Array.isArray(mandis) ? mandis : [mandis];

      // Validate fields
      for (const m of mandiList) {
        if (!m.name || !state) {
          return res.redirect('/mandi?error=Please fill all mandi names and select a state');
        }
      }

      // Check for duplicate names in request (case insensitive)
      const names = mandiList.map(m => m.name.trim());
      const lowerNames = names.map(n => n.toLowerCase());
      const uniqueNames = [...new Set(lowerNames)];
      if (uniqueNames.length !== names.length) {
        return res.redirect('/mandi?error=Duplicate mandi names in input');
      }

      // Check for existing mandis in DB (case insensitive)
      const existingMandis = await SabjiMandi.find({
        name: { $in: names.map(n => new RegExp(`^${n}$`, 'i')) },
        state: state
      });
      if (existingMandis.length) {
        return res.redirect('/mandi?error=Some mandi names already exist in this state');
      }

      // Bulk insert
      await SabjiMandi.insertMany(mandiList.map(m => ({ name: m.name.trim(), state })));
      res.redirect('/mandi');
    } catch (err) {
      console.error('Error creating mandis:', err);
      res.redirect('/mandi?error=Something went wrong while adding mandis');
    }
  }

  // Update mandi inline
  async updateMandi(req, res) {
    try {
      const { id, name, state } = req.body;
      if (!id || !name || !state) {
        return res.redirect('/mandi?error=Missing required fields');
      }

      // Prevent duplicates (except itself)
      const existing = await SabjiMandi.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        state: state
      });
      if (existing) {
        return res.redirect('/mandi?error=Duplicate mandi name exists in this state');
      }

      await SabjiMandi.findByIdAndUpdate(id, { name, state });
      res.redirect('/mandi');
    } catch (err) {
      console.error('Error updating mandi:', err);
      res.redirect('/mandi?error=Error updating mandi');
    }
  }

  // Delete mandi
  async deleteMandi(req, res) {
    try {
      const { id } = req.params;
      await SabjiMandi.findByIdAndDelete(id);
      res.redirect('/mandi');
    } catch (err) {
      console.error('Error deleting mandi:', err);
      res.redirect('/mandi?error=Error deleting mandi');
    }
  }
}

module.exports = new MandiController();