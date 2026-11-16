import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { signInWithGoogle, logOutFromFirebase, isFirebaseConfigured } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('story_bible_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Restore authenticated session from backend on startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        // If not authenticated or token expired, clear local state
        setUser(null);
        localStorage.removeItem('story_bible_user');
        localStorage.removeItem('northstar_token');
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    return data;
  };

  const register = async (credentials) => {
    const data = await authService.register(credentials);
    setUser(data.user);
    return data;
  };

  const loginWithGoogle = async () => {
    const { idToken, profile } = await signInWithGoogle();
    const data = await authService.loginWithFirebase(idToken, profile);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await logOutFromFirebase();
    await authService.logout();
    setUser(null);
  };

  const guestLogin = async () => {
    const data = await authService.guestLogin();
    setUser(data.user);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isFirebaseConfigured,
        login,
        register,
        loginWithGoogle,
        logout,
        guestLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
