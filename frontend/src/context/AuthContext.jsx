// =============================================================================
// src/context/AuthContext.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   Global authentication state shared across the entire app.
//   Any component can read the current user or call login/logout
//   without prop drilling (passing data through many component layers).
//
// HOW REACT CONTEXT WORKS:
//   1. AuthProvider wraps the entire app (in main.jsx)
//   2. It holds the auth state (token, user) in useState
//   3. Any component inside the app can call useAuth() to read state
//      or call authLogin() / authLogout() to update it
//   4. When state updates, all components using useAuth() re-render
//
// WHAT'S STORED:
//   - token: the JWT string (also mirrored in localStorage for persistence)
//   - user: { userId, email } (also mirrored in localStorage)
//   Both are loaded from localStorage on startup so the user stays
//   logged in across page refreshes.
// =============================================================================

import { createContext, useContext, useState, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout } from '../api/auth';

// Create the context object. The default value (null) is only used if a
// component calls useAuth() outside of an AuthProvider — we throw an error
// for that case instead (see useAuth below).
const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// AuthProvider
//
// Wraps the app and provides auth state to all children.
// This is a React component — it renders its children unchanged but
// provides the auth context value to the entire subtree.
// ---------------------------------------------------------------------------
export const AuthProvider = ({ children }) => {
  // Initialize state from localStorage so the user stays logged in
  // after a page refresh. localStorage.getItem returns null if not set.
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    // Parse the stored JSON string back into an object, or null if not set
    return stored ? JSON.parse(stored) : null;
  });

  // -------------------------------------------------------------------------
  // authLogin(email, password)
  //
  // Calls the login API, stores the token and user in state + localStorage.
  // Components call this instead of calling the API directly so that
  // the global state is always in sync.
  //
  // RETURNS: the API response (so the caller can redirect after success)
  // THROWS:  re-throws API errors so the Login page can show the error message
  // -------------------------------------------------------------------------
  const authLogin = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
      // data = { message, token, userId, email }

    // Persist to localStorage — survives page refresh
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({ userId: data.userId, email: data.email }));

    // Update React state — triggers re-render in all components using useAuth()
    setToken(data.token);
    setUser({ userId: data.userId, email: data.email });

    return data;
  }, []);

  // -------------------------------------------------------------------------
  // authLogout()
  //
  // Calls the logout API to blacklist the token, then clears local state.
  // Even if the API call fails (e.g., network error), we still clear
  // local state so the user is effectively logged out on this device.
  // -------------------------------------------------------------------------
  const authLogout = useCallback(async () => {
    try {
      await apiLogout(); // Blacklist the token on the server
    } catch (err) {
      // Log but don't block logout — clear local state regardless
      console.warn('[AuthContext] Server logout failed:', err.message);
    } finally {
      // Always clear local state and storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  }, []);

  // The value object is what any child component receives when it calls useAuth()
  const value = {
    token,          // The JWT string (null if not logged in)
    user,           // { userId, email } (null if not logged in)
    isLoggedIn: !!token, // Boolean convenience flag
    authLogin,      // Call to log in
    authLogout,     // Call to log out
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// useAuth()
//
// Custom hook — the clean way for components to access auth state.
// Usage: const { user, isLoggedIn, authLogin, authLogout } = useAuth();
//
// Throws if called outside AuthProvider (developer error, not user error).
// ---------------------------------------------------------------------------
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider. Wrap your app in <AuthProvider>.');
  }
  return context;
};
