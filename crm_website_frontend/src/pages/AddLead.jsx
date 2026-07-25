import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from "react-hot-toast";

export default function AddLead({ addLead, user, products = [] }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    origin: '',
    destination: '',
    leadSource: '',
    product: '',
    mailId: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhoneChange = (e) => {
    // Restrict input to digits only and maximum of 10 characters
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    setFormData({ ...formData, phone: val });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.phone) {
      toast.error("Phone number is required");
      return;
    }

    if (formData.phone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    setSubmitting(true);
    try {
      const success = await addLead(formData);
      if (success) {
        setFormData({
          name: '',
          phone: '',
          origin: '',
          destination: '',
          leadSource: '',
          product: '',
          mailId: ''
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 transition-colors">
        <div className="bg-orange-500 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Add New Lead</h2>
          <p className="mt-1 text-orange-100 text-xs">
            Enter the details of the prospective client below to add them to the CRM.
          </p>
        </div>

        <div className="px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Full Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Full Name</label>
              <div className="mt-1">
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Row 2: Phone Number & Mail ID */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    required
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border"
                    placeholder="10 digit number"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mailId" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Mail ID</label>
                <div className="mt-1">
                  <input
                    type="email"
                    name="mailId"
                    id="mailId"
                    value={formData.mailId}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Lead Source & Origin City */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="leadSource" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Lead Source</label>
                <div className="mt-1">
                  <select
                    name="leadSource"
                    id="leadSource"
                    value={formData.leadSource}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border cursor-pointer focus:outline-none"
                  >
                    <option value="">Select a source...</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="AdCampaign">AdCampaign</option>
                    <option value="Referral">Referral</option>
                    <option value="Website">Website</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="origin" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Origin City</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="origin"
                    id="origin"
                    value={formData.origin}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border"
                    placeholder="New Delhi"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Product & Destination of Interest */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="product" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Product</label>
                <div className="mt-1">
                  <select
                    name="product"
                    id="product"
                    value={formData.product}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border cursor-pointer focus:outline-none"
                  >
                    <option value="">Select a product...</option>
                    {products.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="destination" className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Destination of Interest</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="destination"
                    id="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-orange-500 focus:border-orange-500 block w-full sm:text-sm border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-md py-2 px-3 border"
                    placeholder="Paris, France"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {submitting ? 'Adding Lead...' : 'Add Client Lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
