const Commodity = require('../models/commodity');

class CommodityController {

  // Render page with all commodities
  async renderPage(req, res) {
    try {
      const commodities = await Commodity.find().sort({ name: 1 });
      const { message, error } = req.query;
      res.render('commodities', { commodities, message, error });
    } catch (err) {
      console.error('Error loading commodities:', err);
      res.status(500).send('Error loading page');
    }
  }

  // Add multiple commodities at once
  async addCommodities(req, res) {
    try {
      let { names } = req.body;
      if (!names) return res.redirect('/commodities?error=No names provided');

      const nameArray = names
        .split(/[\n,]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (nameArray.length === 0) 
        return res.redirect('/commodities?error=Please enter valid names');

      let added = [];
      let skipped = [];

      for (const rawName of nameArray) {
        // Capitalize properly
        const formattedName = rawName
          .toLowerCase()
          .split(' ')
          .filter(w => w.length > 0)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        // Case-insensitive check
        const existing = await Commodity.findOne({
          name: { $regex: `^${formattedName}$`, $options: 'i' }
        });

        if (existing) {
          skipped.push(formattedName);
        } else {
          await Commodity.create({ name: formattedName });
          added.push(formattedName);
        }
      }

      let msg = [];
      if (added.length > 0) msg.push(`✅ Added: ${added.join(', ')}`);
      if (skipped.length > 0) msg.push(`⚠️ Skipped (duplicates): ${skipped.join(', ')}`);

      res.redirect(`/commodities?message=${encodeURIComponent(msg.join(' | '))}`);
    } catch (err) {
      console.error(err);
      res.redirect('/commodities?error=Error adding commodities');
    }
  }

  // Update commodity
  async updateCommodity(req, res) {
    try {
      const { id, name } = req.body;
      if (!id || !name) return res.redirect('/commodities?error=Invalid data');

      // Proper capitalization
      const formattedName = name
        .toLowerCase()
        .split(' ')
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      // Case-insensitive duplicate check excluding current id
      const duplicate = await Commodity.findOne({
        name: { $regex: `^${formattedName}$`, $options: 'i' },
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.redirect('/commodities?error=Duplicate name not allowed');
      }

      await Commodity.findByIdAndUpdate(id, { name: formattedName });
      res.redirect('/commodities?message=Updated successfully');

    } catch (err) {
      console.error('Error updating commodity:', err);
      res.redirect('/commodities?error=Error updating commodity');
    }
  }

  // Delete commodity
  async deleteCommodity(req, res) {
    try {
      const { id } = req.params;
      if (!id) return res.redirect('/commodities?error=Invalid ID');

      await Commodity.findByIdAndDelete(id);
      res.redirect('/commodities?message=Deleted successfully');
    } catch (err) {
      console.error('Error deleting commodity:', err);
      res.redirect('/commodities?error=Error deleting commodity');
    }
  }

  // Get all commodities for autocomplete
  async getAll(req, res) {
    try {
      const { query } = req.query;
      let filter = {};
      if (query) filter.name = { $regex: query, $options: 'i' };

      const commodities = await Commodity.find(filter).sort({ name: 1 });
      res.json(commodities.map(c => c.name));
    } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching commodities');
    }
  }
}

module.exports = new CommodityController();
