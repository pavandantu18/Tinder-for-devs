// =============================================================================
// src/pages/OAuthCallbackPage.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   Handles the redirect from Google OAuth.
//   After Google OAuth succeeds, the backend redirects to:
//     /oauth/callback?token=eyJ...
//   This page reads the token from the URL, stores it, and redirects to /dashboard.
//
// WHY A SEPARATE PAGE:
//   The backend can't set localStorage directly — it can only redirect.
//   So it passes the token in the URL query string, and this page picks it up.
// =============================================================================

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
    // useSearchParams parses ?token=eyJ... from the URL

  const navigate = useNavigate();
  const { authLogin } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      // Google auth failed or was denied — go to login with error
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    if (token) {
      // Decode the JWT payload to get userId and email
      // JWT structure: header.payload.signature — all base64 encoded
      // We decode the payload (middle part) to extract user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
          // atob() decodes base64. split('.')[1] gets the payload section.

        // Store token and user in localStorage + React state
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify({
          userId: payload.sub,
          email: payload.email,
        }));

        // Reload the page to re-initialize AuthContext with the new token
        // (simpler than manually syncing context state here)
        window.location.replace('/dashboard');
      } catch {
        navigate('/login?error=invalid_token', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, []); // Run once on mount

  // Show a brief loading state while the token is being processed
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: '#888',
      fontSize: '16px',
    }}>
      Completing sign in...
    </div>
  );
};

export default OAuthCallbackPage;
