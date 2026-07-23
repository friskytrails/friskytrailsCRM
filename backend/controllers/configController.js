const GlobalConfig = require('../models/GlobalConfig');

const getConfig = async (req, res) => {
  try {
    const config = await GlobalConfig.findOneAndUpdate(
      { key: 'GLOBAL_SETTINGS' },
      { $setOnInsert: { key: 'GLOBAL_SETTINGS' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(config);
  } catch (error) {
    console.error('Error fetching global config:', error);
    res.status(500).json({ error: 'Failed to fetch global config' });
  }
};

const updateProducts = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Products must be an array of strings' });
    }

    const validProducts = [];
    const seen = new Set();
    for (const p of products) {
      if (typeof p !== 'string') {
        return res.status(400).json({ error: 'All products must be strings' });
      }
      const trimmed = p.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Product names cannot be blank' });
      }
      if (seen.has(trimmed.toLowerCase())) {
        return res.status(400).json({ error: 'Duplicate products are not allowed' });
      }
      seen.add(trimmed.toLowerCase());
      validProducts.push(trimmed);
    }

    const config = await GlobalConfig.findOneAndUpdate(
      { key: 'GLOBAL_SETTINGS' },
      { 
        $setOnInsert: { key: 'GLOBAL_SETTINGS' },
        $set: { products: validProducts } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.json(config);
  } catch (error) {
    console.error('Error updating products:', error);
    res.status(500).json({ error: 'Failed to update products' });
  }
};

module.exports = {
  getConfig,
  updateProducts
};
