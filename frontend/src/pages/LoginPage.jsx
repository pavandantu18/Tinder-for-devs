// =============================================================================
// src/pages/LoginPage.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   The login screen. Users enter email + password to get a JWT.
//   Also provides a Google OAuth button and a link to the register page.
//
// STATE MANAGED HERE:
//   email, password  — controlled inputs (React owns the values)
//   error            — error message string to show below the form
//   loading          — true while the API call is in progress (disables button)
//
// AFTER SUCCESSFUL LOGIN:
//   AuthContext.authLogin() stores the token and user.
//   We redirect to /dashboard (or wherever the user was trying to go).
// =============================================================================

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

const LoginPage = () => {
  // Form state — controlled inputs keep React in sync with what the user types
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');     // Error message to display
  const [loading, setLoading] = useState(false); // Prevents double-submit

  const { authLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to redirect after login.
  // If the user was redirected here from a protected route, send them back there.
  // Otherwise, go to /dashboard.
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  // -------------------------------------------------------------------------
  // handleSubmit — called when the form is submitted
  //
  // Prevents the default HTML form submission (which would reload the page),
  // calls the login API, and redirects on success.
  // -------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault(); // Stop browser's default form submit behaviour

    // Basic client-side check before hitting the network
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');      // Clear any previous error
    setLoading(true);  // Disable the button

    try {
      await authLogin(email, password);
        // authLogin calls POST /api/auth/login and stores the token globally

      navigate(redirectTo, { replace: true });
        // replace: true → don't add /login to history (Back button skips it)
    } catch (err) {
      // Extract the error message from the API response
      // err.response.data.error is the { error: "..." } field from our backend
      const message = err.response?.data?.error || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false); // Re-enable the button whether it succeeded or failed
    }
  };

  // -------------------------------------------------------------------------
  // handleGoogleLogin — redirects to Google OAuth flow
  //
  // We navigate directly to the backend's Google auth route.
  // The backend redirects to Google, Google redirects back to /api/auth/google/callback,
  // which redirects to /oauth/callback with the JWT in the URL.
  // -------------------------------------------------------------------------
  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
      // Full page navigation — React Router's navigate() only works for
      // client-side routes. Google OAuth requires a real server redirect.
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Brand header */}
        <div className="auth-logo">
          <span className="auth-logo-icon">💻</span>
          <h1>DevMatch</h1>
          <p>Find your perfect dev partner</p>
        </div>

        {/* Login form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* noValidate disables HTML5 native validation so we control it */}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
                // Controlled input — every keystroke updates state
              autoComplete="email"
              autoFocus
                // Auto-focus the email field when the page loads
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {/* Error message — only rendered if error string is non-empty */}
          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
              // Disabled while loading so the user can't submit twice
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* OR divider */}
        <div className="auth-divider" style={{ marginTop: '20px' }}>or</div>

        {/* Google OAuth button */}
        <button
          className="btn-google"
          onClick={handleGoogleLogin}
          style={{ marginTop: '12px' }}
        >
          {/* Google logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Link to register page */}
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
