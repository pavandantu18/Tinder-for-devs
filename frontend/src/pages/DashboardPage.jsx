// =============================================================================
// src/pages/DashboardPage.jsx
// =============================================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../api/user';
import NotificationBell from '../components/NotificationBell';
import NavBar from '../components/NavBar';
import '../styles/dashboard.css';

const DashboardPage = () => {
  const { user, authLogout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile()
      .then(({ profile }) => setProfile(profile))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await authLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-page">

      {/* Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-logo">💻 DevMatch</h1>
        <div className="dashboard-header-actions">
          <NotificationBell isLoggedIn={true} />
          <button onClick={handleLogout} className="btn-signout">
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard-main">

        {/* Profile card */}
        <div className="dash-card profile-summary">
          <div className="profile-summary-top">
            <div className="dash-avatar">
              {profile?.photo_url
                ? <img src={profile.photo_url} alt="" />
                : '💻'}
            </div>
            <div className="dash-user-info">
              <div className="dash-name">{profile?.name || user?.email}</div>
              <div className="dash-email">{user?.email}</div>
            </div>
          </div>

          {!loading && !profile?.is_complete && (
            <div className="dash-nudge">
              ⚠ Complete your profile to appear in the discovery feed — add your name and at least one skill.
            </div>
          )}

          {profile?.skills?.length > 0 && (
            <div className="dash-skills">
              {profile.skills.map((s) => (
                <span key={s} className="dash-skill-tag">{s}</span>
              ))}
            </div>
          )}

          <Link to="/profile/edit" className="btn-edit-profile">
            {profile?.is_complete ? 'Edit Profile' : 'Complete Profile →'}
          </Link>
        </div>

        {/* Discover card */}
        <div className="dash-card discover-cta">
          <div className="discover-cta-icon">🃏</div>
          <p className="discover-cta-text">
            {profile?.is_complete
              ? 'Your profile is live — start swiping on other developers!'
              : 'Complete your profile first to unlock the swipe feed.'}
          </p>
          {profile?.is_complete ? (
            <div className="discover-cta-buttons">
              <Link to="/discover" className="btn-swipe">
                Start Swiping →
              </Link>
              <Link to="/matches" className="btn-matches">
                ❤️ Matches
              </Link>
            </div>
          ) : (
            <Link to="/profile/edit" className="btn-matches">
              Complete Profile →
            </Link>
          )}
        </div>

      </main>
      <NavBar />
    </div>
  );
};

export default DashboardPage;
