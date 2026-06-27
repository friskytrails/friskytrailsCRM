import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register({ setToken, setUser, API_URL }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('agent'); // 'agent' or 'admin'
  const [inviteCode, setInviteCode] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('All fields are required');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (role === 'admin' && !inviteCode) {
      toast.error('Admin invite code is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, inviteCode }),
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
        if (data.isPending) {
          toast.success(data.message, { duration: 5000 });
          navigate('/'); // Go back to login
        } else if (data.token && data.user) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setToken(data.token);
          setUser(data.user);
          toast.success(`Account verified! Welcome, ${data.user?.name || 'Admin'}!`);
          navigate('/');
        } else {
          toast.error('Verification failed: Invalid response from server');
        }
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
            {step === 1 ? 'Create an Account' : 'Verify Email'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            {step === 1
              ? 'Sign up to get started with FriskyTrails.'
              : `We sent a 6-digit code to ${email}`
            }
          </p>
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-6" onSubmit={handleRegisterSubmit}>
            {/* Role Selection Tabs */}
            <div className="flex rounded-lg bg-gray-100 dark:bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setRole('agent')}
                className={`flex-1 text-sm font-semibold py-2 px-4 rounded-md transition-colors ${role === 'agent' ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
              >
                Agent Registration
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex-1 text-sm font-semibold py-2 px-4 rounded-md transition-colors ${role === 'admin' ? 'bg-white dark:bg-slate-800 shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
              >
                Admin Registration
              </button>
            </div>

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
              
              {role === 'admin' && (
                <div>
                  <label htmlFor="inviteCode" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Secret Invite Code
                  </label>
                  <input
                    id="inviteCode"
                    name="inviteCode"
                    type="password"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full text-sm py-2.5 px-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                    placeholder="Enter admin invite code"
                  />
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-sm py-2.5 pl-3 pr-10 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 bg-white dark:bg-slate-900 dark:text-gray-100"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                  >
                    {showPassword ? (
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
                {loading ? 'Processing...' : 'Register'}
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
                {loading ? 'Verifying...' : 'Verify Email'}
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
                Change Details
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
