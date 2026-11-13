import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Lock, Mail, Key } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // For local / hackathon demonstration, store session locally and direct to dashboard
    localStorage.setItem('story_bible_user', JSON.stringify({ email: email || 'author@storybible.ai' }));
    navigate('/dashboard');
  };

  const handleGuestAccess = () => {
    localStorage.setItem('story_bible_user', JSON.stringify({ email: 'guest.author@storybible.ai', isGuest: true }));
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col items-center justify-center p-4 selection:bg-blue-100">
      <div className="w-full max-w-sm text-left">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
            {isSignUp ? 'Create your author workspace' : 'Welcome to Living Story Bible'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Persistent, evidence-backed narrative memory for storytellers.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
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
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
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
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors shadow-2xs mt-2"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          {/* Guest One-Click Access */}
          <div className="mt-5 pt-5 border-t border-neutral-100">
            <button
              onClick={handleGuestAccess}
              className="w-full py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-medium border border-neutral-200 transition-colors flex items-center justify-center space-x-1.5"
            >
              <span>Instant Guest Author Access</span>
              <ArrowRight className="w-3 h-3 text-neutral-400" />
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[11px] text-blue-600 hover:underline font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-700">
            &larr; Back to Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
}
