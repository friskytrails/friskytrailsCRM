const GlobalConfig = require('../models/GlobalConfig');

const getConfig = async (req, res) => {
  try {
    let config = await GlobalConfig.findOne({ key: 'GLOBAL_SETTINGS' });
    if (!config) {
      config = new GlobalConfig({ key: 'GLOBAL_SETTINGS' });
      await config.save();
    }
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

    let config = await GlobalConfig.findOne({ key: 'GLOBAL_SETTINGS' });
    if (!config) {
      config = new GlobalConfig({ key: 'GLOBAL_SETTINGS' });
    }
    
    config.products = products;
    await config.save();
    
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
