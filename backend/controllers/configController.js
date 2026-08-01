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
    if (!Array.isArray(products) || !products.every(p => typeof p === 'string' && p.trim().length > 0)) {
      return res.status(400).json({ error: 'Products must be an array of non-empty strings' });
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

const updateStatuses = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    
    const { statuses } = req.body;
    if (!Array.isArray(statuses) || statuses.length === 0 || !statuses.every(s => typeof s === 'string' && s.trim().length > 0)) {
      return res.status(400).json({ error: 'Statuses must be an array of non-empty strings' });
    }

    const validStatuses = [];
    const seen = new Set();
    for (const s of statuses) {
      if (typeof s !== 'string') {
        return res.status(400).json({ error: 'All statuses must be strings' });
      }
      const trimmed = s.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Status names cannot be blank' });
      }
      if (seen.has(trimmed.toLowerCase())) {
        return res.status(400).json({ error: 'Duplicate statuses are not allowed' });
      }
      seen.add(trimmed.toLowerCase());
      validStatuses.push(trimmed);
    }

    const config = await GlobalConfig.findOneAndUpdate(
      { key: 'GLOBAL_SETTINGS' },
      { 
        $setOnInsert: { key: 'GLOBAL_SETTINGS' },
        $set: { statuses: validStatuses } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.json(config);
  } catch (error) {
    console.error('Error updating statuses:', error);
    res.status(500).json({ error: 'Failed to update statuses' });
  }
};

module.exports = {
  getConfig,
  updateProducts,
  updateStatuses
};
