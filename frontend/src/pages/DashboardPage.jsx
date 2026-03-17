// =============================================================================
// src/pages/DashboardPage.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   Placeholder dashboard shown after successful login.
//   This will become the main swipe interface in Step 9 (full frontend).
//   For now it confirms auth is working end-to-end and provides a logout button.
// =============================================================================

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, authLogout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authLogout(); // Blacklists token on server, clears local state
    navigate('/login', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      padding: '24px',
      background: 'radial-gradient(ellipse at top, #2a0a0e 0%, #0f0f0f 60%)',
    }}>

      {/* Welcome card */}
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>💻</div>

        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fd5564', marginBottom: '8px' }}>
          Welcome to DevMatch!
        </h1>

        <p style={{ color: '#888', fontSize: '15px', marginBottom: '24px' }}>
          Logged in as <strong style={{ color: '#fff' }}>{user?.email}</strong>
        </p>

        {/* Placeholder message — this becomes the swipe UI in Step 9 */}
        <div style={{
          background: '#111',
          border: '1px dashed #333',
          borderRadius: '8px',
          padding: '24px',
          color: '#555',
          fontSize: '14px',
          marginBottom: '28px',
        }}>
          🚧 Swipe interface coming in Step 9
          <br />
          <span style={{ fontSize: '12px' }}>
            Auth is working — JWT stored, Kafka event emitted
          </span>
        </div>

        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#888',
            padding: '10px 24px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#fd5564';
            e.target.style.color = '#fd5564';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#333';
            e.target.style.color = '#888';
          }}
        >
          Sign out
        </button>
      </div>

    </div>
  );
};

export default DashboardPage;
