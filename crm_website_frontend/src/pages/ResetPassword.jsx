import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ResetPassword({ API_URL, setToken, setUser }) {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !otp || !newPassword) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Password has been successfully reset');
        if (setToken) setToken('');
        if (setUser) setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
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
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            Enter the reset code sent to your email and your new password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
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
                readOnly={!!location.state?.email}
              />
            </div>

            <div>
              <label htmlFor="otp" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Reset Code (OTP)
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100 tracking-widest"
                placeholder="123456"
                maxLength={6}
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                New Password
              </label>
            <div className="relative">
              <input
                id="new-password"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-sm py-2.5 pl-3 pr-10 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
                aria-pressed={showNewPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              >
                {showNewPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
          
          <div className="text-center mt-4">
            <span className="text-sm text-gray-600 dark:text-slate-400">
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
