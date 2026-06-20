import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register({ setToken, setUser, API_URL }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(() => location.state?.requireVerificationFor ? 2 : 1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => location.state?.requireVerificationFor || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.requireVerificationFor) {
      const emailToVerify = location.state.requireVerificationFor;

      const autoResend = async () => {
        try {
          const res = await fetch(`${API_URL}/auth/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailToVerify }),
          });
          if (res.ok) {
            toast.success('A fresh OTP has been sent to your email!');
          }
        } catch (error) {
          console.error('Failed to auto-resend OTP', error);
          toast.error('Failed to auto-resend OTP');
        }
      };

      autoResend();

      // Clear state to prevent loop if user refreshes
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, API_URL]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'OTP sent to your email!');
        setStep(2); // Move to OTP step
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not connect to the authentication server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!otp) {
      toast.error('Please enter the OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();

      if (res.ok) {
        if (!data || !data.token || !data.user || !data.user.name) {
          toast.error('Invalid server response during verification');
          return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        toast.success(`Account verified! Welcome, ${data.user?.name || 'Agent'}!`);
        navigate('/');
      } else {
        toast.error(data.error || 'Verification failed');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not connect to the authentication server');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'New OTP sent to your email!');
      } else {
        toast.error(data.error || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not connect to the authentication server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 transition-colors">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {step === 1 ? 'Create Agent Account' : 'Verify Email'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            {step === 1
              ? 'Sign up to get started as a travel agent.'
              : `We sent a 6-digit code to ${email}`
            }
          </p>
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={handleRegisterSubmit}>
            <div className="rounded-md space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  placeholder="John Doe"
                />
              </div>
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
                <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Creating Account...' : 'Register'}
              </button>
            </div>

            <div className="text-center mt-4">
              <span className="text-sm text-gray-600 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/" className="font-semibold text-orange-600 hover:text-orange-500 transition-colors">
                  Sign In
                </Link>
              </span>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifySubmit}>
            <div className="rounded-md space-y-4">
              <div>
                <label htmlFor="otp" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 text-center">
                  6-Digit OTP
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                  placeholder="------"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleResendOtp}
                className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Resend Code
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-sm text-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 pt-2"
              >
                Change Email Address
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
