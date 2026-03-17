// =============================================================================
// src/pages/DashboardPage.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   Main hub after login. Shows profile completion status and navigation
//   to key features. Will become the swipe interface in Step 9.
// =============================================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../api/user';

const DashboardPage = () => {
  const { user, authLogout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load profile on mount to show completion status
  useEffect(() => {
    getMyProfile()
      .then(({ profile }) => setProfile(profile))
      .catch(() => {}) // Silently ignore — profile may still be initializing
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await authLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #2a0a0e 0%, #0f0f0f 60%)',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fd5564' }}>💻 DevMatch</h1>
        <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #333', borderRadius: 8, color: '#888', padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>

      {/* Profile card */}
      <div style={{ width: '100%', maxWidth: 560, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, overflow: 'hidden', flexShrink: 0 }}>
            {profile?.photo_url ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💻'}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#fff' }}>{profile?.name || user?.email}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{user?.email}</div>
          </div>
        </div>

        {/* Completion nudge */}
        {!loading && !profile?.is_complete && (
          <div style={{ background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ffaa00' }}>
            ⚠ Complete your profile to appear in the discovery feed — add your name and at least one skill.
          </div>
        )}

        {/* Skills preview */}
        {profile?.skills?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {profile.skills.map((s) => (
              <span key={s} style={{ background: 'rgba(253,85,100,0.1)', border: '1px solid rgba(253,85,100,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#fd5564' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        <Link to="/profile/edit" style={{ display: 'block', textAlign: 'center', background: '#fd5564', color: '#fff', borderRadius: 8, padding: '11px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
          {profile?.is_complete ? 'Edit Profile' : 'Complete Profile →'}
        </Link>
      </div>

      {/* Discover / swipe feed */}
      <div style={{ width: '100%', maxWidth: 560, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🃏</div>
        <div style={{ fontSize: 15, color: '#ccc', marginBottom: 16 }}>
          {profile?.is_complete
            ? 'Your profile is live — start swiping on other developers!'
            : 'Complete your profile first to unlock the swipe feed.'}
        </div>
        {profile?.is_complete ? (
          <Link to="/discover" style={{ display: 'inline-block', background: '#fd5564', color: '#fff', borderRadius: 8, padding: '11px 32px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Start Swiping →
          </Link>
        ) : (
          <Link to="/profile/edit" style={{ display: 'inline-block', border: '1px solid #fd5564', color: '#fd5564', borderRadius: 8, padding: '11px 32px', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Complete Profile →
          </Link>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;
