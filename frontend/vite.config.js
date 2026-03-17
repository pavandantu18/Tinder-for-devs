// =============================================================================
// vite.config.js
// Project: DevMatch Frontend
//
// PURPOSE:
//   Configures the Vite build tool and dev server.
//
// WHAT VITE DOES:
//   - Dev mode:   serves files with hot module replacement (HMR) — changes
//                 appear in the browser instantly without a full page reload
//   - Build mode: bundles and minifies all files into static assets in /dist
//
// PROXY:
//   In development, the React app runs on port 5173 and the API runs on
//   port 3001 (auth-service) or 3000 (API gateway, added in Step 3).
//   Browsers block requests from port 5173 → 3001 due to CORS unless the
//   server explicitly allows it (which ours does), but using a proxy keeps
//   all API calls on the same origin in the browser's perspective.
//
//   Any request starting with /api is forwarded to the target.
//   Example: fetch('/api/auth/login') → http://localhost:3001/api/auth/login
//   This will be updated to point to the API Gateway (port 3000) in Step 3.
// =============================================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(), // Enables JSX transform and React Fast Refresh (hot reloading)
  ],

  server: {
    port: 5173,      // Dev server port — matches docker-compose.yml port mapping
    host: '0.0.0.0', // Listen on all interfaces — needed for Docker to expose the port

    proxy: {
      '/api': {
        target: 'http://api-gateway:3000',
        changeOrigin: true,
      },
      // Socket.IO WebSocket proxy — must be separate from /api
      // ws: true enables WebSocket upgrade proxying (required for Socket.IO)
      '/socket.io': {
        target: 'http://api-gateway:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
