import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Mail, Key, User, AlertCircle, Loader2 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, guestLogin } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTarget = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    try {
      setSubmitting(true);
      if (isSignUp) {
        await register({
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
          full_name: fullName.trim() || undefined,
        });
      } else {
        await login({
          email: email.trim(),
          password,
        });
      }
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Authentication failed. Please check your credentials.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestAccess = async () => {
    setError('');
    try {
      setSubmitting(true);
      await guestLogin();
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to initialize guest session.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbf9] dark:bg-neutral-950 flex flex-col items-center justify-center p-4 selection:bg-blue-100 transition-colors relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm text-left">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {isSignUp ? 'Create your author workspace' : 'Welcome to NorthStar'}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Persistent, evidence-backed narrative memory for storytellers.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start space-x-2 text-red-700 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Full Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="J.R.R. Tolkien"
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="author@novel.com"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full text-xs pl-9 pr-3 py-2.5 border border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold transition-colors shadow-2xs mt-2 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
            </button>
          </form>

          {/* Guest One-Click Access */}
          <div className="mt-5 pt-5 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleGuestAccess}
              disabled={submitting}
              className="w-full py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-neutral-700 transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <span>Instant Guest Author Access</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
            &larr; Back to Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
}
