import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function GlobalSettings({ products, setProducts, API_URL, token }) {
  const [localProducts, setLocalProducts] = useState([...products]);
  const [newProduct, setNewProduct] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalProducts([...products]);
  }, [products]);

  const handleAddProduct = (e) => {
    e.preventDefault();
    const trimmed = newProduct.trim();
    if (!trimmed) return;
    
    if (localProducts.includes(trimmed)) {
      toast.error('This product already exists.');
      return;
    }

    setLocalProducts([...localProducts, trimmed]);
    setNewProduct('');
  };

  const handleRemoveProduct = (indexToRemove) => {
    setLocalProducts(localProducts.filter((_, index) => index !== indexToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/config/products`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ products: localProducts })
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        toast.success('Products updated successfully.');
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(`Failed to update products: ${err.error || response.statusText}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Server connection error.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Global Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Manage global configuration and options for the CRM.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/80 backdrop-blur shadow-sm rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700/80 transition-colors">
        <div className="p-6 sm:p-8">
          <div className="mb-8 border-b border-gray-200 dark:border-slate-700/80 pb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Products Dropdown Options
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Manage the products available in the "Add Lead" dropdown on the website and mobile app.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Column 1: Current Products */}
            <div className="flex flex-col h-full">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-4">Current Products</h4>
              <div className="space-y-3 flex-grow overflow-y-auto max-h-[350px] pr-2">
                {localProducts.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-slate-400 italic bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                    No products added yet.
                  </div>
                ) : (
                  localProducts.map((product, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50/80 dark:bg-slate-900/50 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-800 transition-colors group shadow-sm">
                      <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{product}</span>
                      <button
                        onClick={() => handleRemoveProduct(index)}
                        className="text-gray-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove product"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Add Product & Save */}
            <div className="flex flex-col border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700/80 pt-6 md:pt-0 md:pl-8">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-4">Add New Product</h4>
              <form onSubmit={handleAddProduct} className="flex flex-col gap-3 mb-8">
                <input
                  type="text"
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                  placeholder="E.g., Spiti Valley Expedition"
                  className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900/80 text-gray-900 dark:text-gray-100 rounded-xl py-2.5 px-4 border"
                />
                <button
                  type="submit"
                  disabled={!newProduct.trim()}
                  className="inline-flex justify-center py-2.5 px-5 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-gray-900 hover:bg-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Add Product
                </button>
              </form>

              <div className="mt-auto pt-8 border-t border-gray-200 dark:border-slate-700/80">
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                  Don't forget to save your changes to update the live dropdown options across the CRM platform.
                </p>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full inline-flex items-center justify-center py-3 px-6 border border-transparent shadow-md text-sm font-bold rounded-xl text-white bg-orange-600 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-all"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Config Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
