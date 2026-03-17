// =============================================================================
// src/App.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   Defines all client-side routes and which component renders for each URL.
//   React Router intercepts URL changes and renders the matching component
//   without doing a full page reload (Single Page Application behaviour).
//
// ROUTES:
//   /           → redirect to /login (or /dashboard if logged in)
//   /login      → Login page (public)
//   /register   → Register page (public)
//   /dashboard  → Dashboard (protected — redirects to /login if not logged in)
//   /oauth/callback → handles the token from Google OAuth redirect
// =============================================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfileEditPage from './pages/ProfileEditPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      {/* Root — redirect based on login state */}
      <Route
        path="/"
        element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />}
        // `replace` replaces the current history entry instead of pushing a new one.
        // Without it, hitting Back after the redirect would loop.
      />

      {/* Public routes — accessible without a token */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* OAuth callback — receives token from Google redirect */}
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      {/* Protected routes — ProtectedRoute redirects to /login if not logged in */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <ProfileEditPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all — any unknown URL goes to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
