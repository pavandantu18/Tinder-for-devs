// =============================================================================
// src/main.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   The React entry point. Mounts the root component into the DOM.
//   This is the first JavaScript file that runs.
//
// PROVIDER ORDER MATTERS:
//   Providers wrap children — inner components can only access providers
//   that wrap them. AuthProvider must be outside (above) BrowserRouter
//   so that route-level components can access auth state. BrowserRouter
//   must wrap everything that uses React Router hooks (useNavigate, etc.).
// =============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles/index.css'; // Global styles applied to the whole app

// ReactDOM.createRoot() is the React 18 way to mount the app.
// It enables concurrent features (automatic batching, transitions, etc.)
// document.getElementById('root') finds the <div id="root"> in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*
      StrictMode renders components twice in development to catch side effects.
      Has no effect in production builds.
    */}
    <BrowserRouter>
      {/* AuthProvider gives every component in the tree access to auth state */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
