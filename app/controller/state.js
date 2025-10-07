const State = require('../models/state');

class StateController {
  // Render page with success/error messages
  async renderPage(req, res) {
    try {
      const states = await State.find().sort({ name: 1 });
      const { message, error } = req.query;
      res.render('states', { states, message, error });
    } catch (err) {
      console.error('Error loading states:', err);
      res.status(500).send('Error loading page');
    }
  }

  // Add multiple states
async createStates(req, res) {
  try {
    let { names } = req.body;
    if (!names) return res.redirect('/states?error=No state names provided');

    // Split input by comma or newline and clean it
    const nameArray = names
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (nameArray.length === 0)
      return res.redirect('/states?error=Please enter valid state names');

    let added = [];
    let skipped = [];

    for (const rawName of nameArray) {
      // Normalize spacing and case
      const formattedName = rawName
        .toLowerCase()
        .split(' ')
        .filter((w) => w.length > 0)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      // Case-insensitive duplicate check
      const existing = await State.findOne({
        name: { $regex: new RegExp(`^${formattedName}$`, "i") }
      });

      if (existing) {
        skipped.push(formattedName);
      } else {
        await State.create({ name: formattedName });
        added.push(formattedName);
      }
    }

    // Build message
    let msg = [];
    if (added.length > 0) msg.push(`✅ Added: ${added.join(', ')}`);
    if (skipped.length > 0) msg.push(`⚠️ Skipped (duplicates): ${skipped.join(', ')}`);

    res.redirect(`/states?message=${encodeURIComponent(msg.join(' | '))}`);
  } catch (err) {
    console.error('Error creating states:', err);
    res.redirect('/states?error=Error while adding states');
  }
}



  // Edit single state
async updateState(req, res) {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.redirect('/states?error=Invalid data');

    // Format the name: capitalize each word
    const formattedName = name
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Check for case-insensitive duplicate excluding current state
    const duplicate = await State.findOne({
      name: { $regex: new RegExp(`^${formattedName}$`, "i") },
      _id: { $ne: id }
    });

    if (duplicate) {
      return res.redirect('/states?error=Duplicate name not allowed');
    }

    // Update state with properly formatted name
    await State.findByIdAndUpdate(id, { name: formattedName });
    res.redirect('/states?message=Updated successfully');

  } catch (err) {
    console.error('Error updating state:', err);
    res.redirect('/states?error=Error updating state');
  }
}


  // Delete state
  async deleteState(req, res) {
    try {
      const { id } = req.params;
      await State.findByIdAndDelete(id);
      res.redirect('/states?message=Deleted successfully');
    } catch (err) {
      console.error('Error deleting state:', err);
      res.redirect('/states?error=Error deleting state');
    }
  }
}

module.exports = new StateController();
