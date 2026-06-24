import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ForgotPassword({ API_URL }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Reset code sent!');
        navigate('/reset-password', { state: { email } });
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 transition-colors">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            Enter your email address and we'll send you a code to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email-address" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </div>
          
          <div className="text-center mt-4">
            <span className="text-sm text-gray-600 dark:text-slate-400">
              Remember your password?{' '}
              <Link to="/login" className="font-semibold text-orange-600 hover:text-orange-500 transition-colors">
                Back to Sign In
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
