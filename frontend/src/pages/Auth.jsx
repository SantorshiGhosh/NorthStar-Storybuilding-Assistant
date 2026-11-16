import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Check, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
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
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
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

  // Google SSO left with no sign-in function as requested
  const handleGoogleSSO = (e) => {
    e?.preventDefault();
  };

  return (
    <div className="min-h-screen bg-[#faf6ef] text-[#1c1815] font-inter flex flex-col selection:bg-[#7b2d3b] selection:text-[#faf6ef]">
      {/* Sticky Translucent Header */}
      <header className="sticky top-0 z-50 h-[68px] bg-[#faf6ef]/85 backdrop-blur-md border-b border-[#1c1815]/10">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-8 h-full flex items-center justify-between">
          {/* 1. Left: Brand Lockup with NorthStar Logo & Name */}
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#7b2d3b] text-[#faf6ef] flex items-center justify-center shadow-xs group-hover:bg-[#5e1f2b] transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-fraunces text-[19px] font-medium text-[#1c1815] tracking-tight">
              NorthStar
            </span>
          </Link>

          {/* 2. Center: Navigation Panel (Home, About, Help & Support) */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="font-inter text-sm text-[#1c1815]/70 hover:text-[#1c1815] transition-colors editorial-link-underline pb-0.5"
            >
              Home
            </Link>
            <a
              href="/#features"
              className="font-inter text-sm text-[#1c1815]/70 hover:text-[#1c1815] transition-colors editorial-link-underline pb-0.5"
            >
              About
            </a>
            <a
              href="mailto:support@northstar.fiction"
              className="font-inter text-sm text-[#1c1815]/70 hover:text-[#1c1815] transition-colors editorial-link-underline pb-0.5"
            >
              Help &amp; Support
            </a>
          </nav>

          {/* Right: Pill CTA */}
          <div className="flex items-center">
            <span className="hidden sm:inline text-xs text-[#1c1815]/50 font-inter mr-3">
              {isSignUp ? 'Already a member?' : 'New here?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="rounded-full px-4 py-1.5 text-xs font-inter font-medium text-[#7b2d3b] border border-[#7b2d3b]/30 hover:border-[#7b2d3b] hover:bg-[#7b2d3b]/5 transition-all"
            >
              {isSignUp ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Full-Bleed Two-Column Viewport Split */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-68px)]">
        <div className="w-full max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] border border-[#1c1815]/10 rounded-[24px] lg:rounded-[28px] overflow-hidden shadow-xl shadow-[#1c1815]/5">
          {/* 3. Left Column: Editorial Greeting Panel (Matched to NorthStar Story Canon Theme) */}
          <div className="order-2 lg:order-1 bg-[#f3ece0] relative overflow-hidden p-8 sm:p-12 lg:p-14 flex flex-col justify-between border-t lg:border-t-0 lg:border-r border-[#1c1815]/10 min-h-[520px] lg:min-h-[640px]">
            {/* Layered radial-gradient burgundy tints */}
            <div className="absolute inset-0 editorial-radial-tints pointer-events-none" />
            {/* Multiply dot-grain texture */}
            <div className="absolute inset-0 editorial-grain pointer-events-none" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col justify-between h-full space-y-10">
              {/* Top Block: Kicker with rule line */}
              <div className="flex items-center">
                <span className="w-8 h-[2px] bg-[#7b2d3b] mr-3 inline-block" />
                <span className="font-inter text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b2d3b]">
                  AI Continuity Guardian
                </span>
              </div>

              {/* Middle Block: Volume eyebrow + Oversized Fraunces headline + Story Canon Subtext */}
              <div className="max-w-[32ch]">
                <p className="font-inter text-[11px] font-medium uppercase tracking-wider text-[#1c1815]/60 mb-3">
                  Canon Intelligence · Edition 2026
                </p>
                <h1 className="font-fraunces text-4xl sm:text-5xl lg:text-[clamp(2.6rem,6.2vw,4.6rem)] font-light text-[#1c1815] leading-[0.96] tracking-[-0.02em]">
                  Welcome <br />
                  <span className="italic text-[#7b2d3b] font-normal">back.</span>
                </h1>
                <p className="font-fraunces text-[clamp(1.15rem,2vw,1.45rem)] text-[#1c1815]/80 font-light mt-5 leading-relaxed">
                  Your persistent narrative memory for complex story worlds, physical character states, and multi-draft continuity.
                </p>
              </div>

              {/* Bottom Block: Fading rule, blockquote with swash quote, author testimonial */}
              <div>
                <div className="w-full h-[1px] bg-gradient-to-r from-[#1c1815]/20 via-[#1c1815]/10 to-transparent mb-6" />
                <figure className="space-y-4">
                  <blockquote className="font-fraunces text-sm sm:text-base text-[#1c1815]/85 font-light leading-relaxed relative pl-6">
                    <span className="absolute left-0 -top-2 font-fraunces text-3xl text-[#7b2d3b] select-none swash-quote">
                      “
                    </span>
                    NorthStar caught a timeline paradox and a character injury discrepancy between Chapter 4 and Chapter 32 that human passes missed. Total creative certainty.
                  </blockquote>
                  <figcaption className="flex items-center space-x-3 pt-1">
                    <div className="w-9 h-9 rounded-full bg-[#7b2d3b]/15 text-[#7b2d3b] flex items-center justify-center font-fraunces italic font-medium text-sm">
                      E
                    </div>
                    <span className="font-inter text-xs text-[#1c1815]/75">
                      Elena Vance · Fantasy Novelist &amp; Worldbuilder
                    </span>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>

          {/* Right Column: Sign-in Form (Desktop: Right, Mobile: Top order-1) */}
          <div className="order-1 lg:order-2 bg-[#faf6ef] p-8 sm:p-12 lg:p-14 flex items-center justify-center relative">
            <div className="w-full max-w-[400px] mx-auto">
              {/* Header Row: Stacked label + Heading + Tabular Index Numeral */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <span className="block font-inter text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b2d3b] mb-1">
                    {isSignUp ? 'Member registration' : 'Member sign in'}
                  </span>
                  <h2 className="font-fraunces text-3xl sm:text-[2rem] font-normal text-[#1c1815] tracking-tight leading-tight">
                    {isSignUp ? 'Create account' : 'Sign in'}
                  </h2>
                </div>
                <span className="tabular-nums-serif text-4xl font-light text-[#7b2d3b]/25 select-none pt-1">
                  {isSignUp ? '02' : '01'}
                </span>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-[#7b2d3b]/10 border border-[#7b2d3b]/20 flex items-start space-x-2.5 text-[#5e1f2b] text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#7b2d3b]" />
                  <span>{error}</span>
                </div>
              )}

              {/* 4. Google SSO Button (No function / does not auto-sign in) */}
              <button
                type="button"
                onClick={handleGoogleSSO}
                className="w-full py-3 px-4 bg-white/60 hover:bg-[#fffdf9] border border-[#1c1815]/15 hover:border-[#1c1815]/30 rounded-xl flex items-center justify-center space-x-3 text-xs sm:text-sm font-inter font-medium text-[#1c1815] transition-all shadow-2xs group cursor-default"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* 'or with email' Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-[#1c1815]/12" />
                <span className="px-3 font-inter text-[10px] font-semibold tracking-[0.15em] uppercase text-[#1c1815]/45">
                  or with email
                </span>
                <div className="flex-1 border-t border-[#1c1815]/12" />
              </div>

              {/* 5. Form: Email Login + Password */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-xs font-inter font-medium text-[#1c1815]/80 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="J.R.R. Tolkien"
                      className="w-full rounded-xl bg-white/60 border border-[#1c1815]/15 px-3.5 py-2.5 text-xs sm:text-sm text-[#1c1815] placeholder:text-[#1c1815]/35 focus:bg-[#fffdf9] focus:border-[#7b2d3b] focus:ring-4 focus:ring-[#7b2d3b]/10 focus:outline-hidden transition-all shadow-2xs font-inter"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-inter font-medium text-[#1c1815]/80 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="author@novel.com"
                    className="w-full rounded-xl bg-white/60 border border-[#1c1815]/15 px-3.5 py-2.5 text-xs sm:text-sm text-[#1c1815] placeholder:text-[#1c1815]/35 focus:bg-[#fffdf9] focus:border-[#7b2d3b] focus:ring-4 focus:ring-[#7b2d3b]/10 focus:outline-hidden transition-all shadow-2xs font-inter"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-inter font-medium text-[#1c1815]/80">
                      Password
                    </label>
                    {!isSignUp && (
                      <span className="text-xs text-[#7b2d3b] hover:text-[#5e1f2b] font-inter font-medium cursor-pointer editorial-link-underline">
                        Forgot?
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl bg-white/60 border border-[#1c1815]/15 pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-[#1c1815] placeholder:text-[#1c1815]/35 focus:bg-[#fffdf9] focus:border-[#7b2d3b] focus:ring-4 focus:ring-[#7b2d3b]/10 focus:outline-hidden transition-all shadow-2xs font-inter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1c1815]/40 hover:text-[#1c1815] transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isSignUp && (
                  <div>
                    <label className="block text-xs font-inter font-medium text-[#1c1815]/80 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl bg-white/60 border border-[#1c1815]/15 px-3.5 py-2.5 text-xs sm:text-sm text-[#1c1815] placeholder:text-[#1c1815]/35 focus:bg-[#fffdf9] focus:border-[#7b2d3b] focus:ring-4 focus:ring-[#7b2d3b]/10 focus:outline-hidden transition-all shadow-2xs font-inter"
                    />
                  </div>
                )}

                {/* Custom Checkbox: Keep me signed in */}
                <div className="flex items-center space-x-2.5 pt-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={rememberMe}
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      rememberMe
                        ? 'bg-[#7b2d3b] border border-[#7b2d3b]'
                        : 'bg-white/60 border border-[#7b2d3b]/40 hover:border-[#7b2d3b]'
                    }`}
                  >
                    {rememberMe && <Check className="w-3 h-3 text-[#faf6ef] stroke-[3]" />}
                  </button>
                  <label
                    onClick={() => setRememberMe(!rememberMe)}
                    className="font-inter text-xs text-[#1c1815]/75 cursor-pointer select-none"
                  >
                    Keep me signed in for 30 days
                  </label>
                </div>

                {/* Submit Primary Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#7b2d3b] hover:bg-[#5e1f2b] text-[#faf6ef] font-inter font-medium text-sm transition-all shadow-sm hover:shadow-md transform active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin text-[#faf6ef]" />}
                  <span>{isSignUp ? 'Create author account' : 'Sign in to your story canvas'}</span>
                </button>

                {/* 5. Instant Guest Author Access */}
                <button
                  type="button"
                  onClick={handleGuestAccess}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#7b2d3b]/25 hover:border-[#7b2d3b]/60 bg-white/40 hover:bg-white/75 text-[#7b2d3b] font-inter text-xs font-medium transition-all flex items-center justify-center space-x-1.5 mt-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Instant Guest Author Access</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#7b2d3b]" />
                </button>
              </form>

              {/* Bottom Sign up / Sign in Toggle */}
              <div className="mt-6 text-center">
                <span className="font-inter text-xs text-[#1c1815]/70">
                  {isSignUp ? 'Already have an author account? ' : "Don't have an author account? "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                    }}
                    className="text-[#7b2d3b] hover:text-[#5e1f2b] font-semibold editorial-link-underline cursor-pointer"
                  >
                    {isSignUp ? 'Sign in' : 'Start writing free'}
                  </button>
                </span>
              </div>

              {/* Fine-Print Terms & Privacy */}
              <p className="font-inter text-[11.5px] text-[#1c1815]/50 text-center mt-6 leading-relaxed">
                By continuing, you acknowledge NorthStar's{' '}
                <span className="editorial-link-underline hover:text-[#1c1815] cursor-pointer">
                  Terms of Service
                </span>{' '}
                and{' '}
                <span className="editorial-link-underline hover:text-[#1c1815] cursor-pointer">
                  Privacy Policy
                </span>
                .
              </p>

              {/* Back Link */}
              <div className="text-center mt-5">
                <Link
                  to="/"
                  className="font-inter text-xs text-[#1c1815]/45 hover:text-[#7b2d3b] transition-colors"
                >
                  &larr; Back to Landing Page
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
