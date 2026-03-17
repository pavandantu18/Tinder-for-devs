// =============================================================================
// src/components/ProtectedRoute.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   A route guard — wraps protected pages and redirects to /login
//   if the user is not authenticated.
//
// HOW IT WORKS:
//   In App.jsx, protected pages are wrapped like this:
//     <ProtectedRoute>
//       <DashboardPage />
//     </ProtectedRoute>
//
//   When the route renders:
//   - If logged in  → renders the children (the actual page)
//   - If not logged in → redirects to /login
//
//   `state={{ from: location }}` passes the current URL to the login page
//   so after login, the user can be redirected back to where they were.
//   e.g., user tries to open /dashboard → redirected to /login →
//         logs in → redirected back to /dashboard
// =============================================================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const location = useLocation(); // Current URL — passed to login so we can redirect back

  if (!isLoggedIn) {
    // Not logged in — redirect to login page
    // `replace` avoids adding the protected route to browser history
    // (so Back button from login doesn't send user back to the protected page)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in — render the actual page
  return children;
};

export default ProtectedRoute;
