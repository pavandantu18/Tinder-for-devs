// =============================================================================
// src/pages/MatchesPage.jsx
//
// Displays all confirmed mutual matches for the logged-in user.
// Each match shows the other person's name, photo, and skills.
// (In Step 7, clicking a match will open the chat.)
// =============================================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMatches } from '../api/match';
import NavBar from '../components/NavBar';
import '../styles/matches.css';

const MatchesPage = () => {
  const navigate              = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    getMatches()
      .then(({ matches }) => setMatches(matches))
      .catch(() => setError('Failed to load matches.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="matches-loading">
        <div className="spinner" />
        <p>Loading matches...</p>
      </div>
    );
  }

  return (
    <div className="matches-page">
      <div className="matches-header">
        <h1>Matches</h1>
        <span className="match-count">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
      </div>

      {error && <p className="matches-error">{error}</p>}

      {matches.length === 0 && !error ? (
        <div className="matches-empty">
          <div className="empty-icon">💔</div>
          <h2>No matches yet</h2>
          <p>Keep swiping — your first match is out there!</p>
          <Link to="/discover" className="btn-primary">Start Swiping</Link>
        </div>
      ) : (
        <div className="matches-grid">
          {matches.map((match) => (
            <div key={match.id} className="match-card">
              {/* Photo */}
              <div className="match-photo">
                {match.user?.photo_url ? (
                  <img src={match.user.photo_url} alt={match.user.name} />
                ) : (
                  <div className="match-photo-placeholder">
                    {match.user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="match-badge">❤️</div>
              </div>

              {/* Info */}
              <div className="match-info">
                <h3 className="match-name">{match.user?.name || 'Unknown'}</h3>

                {match.user?.skills?.length > 0 && (
                  <div className="match-skills">
                    {match.user.skills.slice(0, 3).map((s) => (
                      <span key={s} className="skill-tag">{s}</span>
                    ))}
                    {match.user.skills.length > 3 && (
                      <span className="skill-tag">+{match.user.skills.length - 3}</span>
                    )}
                  </div>
                )}

                <p className="match-date">
                  Matched {new Date(match.createdAt).toLocaleDateString()}
                </p>

                <button
                  className="btn-chat"
                  onClick={() => navigate(`/chat/${match.id}`, { state: { matchedUser: match.user } })}
                >
                  💬 Message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <NavBar />
    </div>
  );
};

export default MatchesPage;
