// =============================================================================
// src/pages/DiscoverPage.jsx
//
// THE SWIPE FEED — the core of DevMatch.
//
// HOW IT WORKS:
//   1. On mount, fetch a page of discover profiles from User Service
//   2. Show the top card (profiles[currentIndex])
//   3. User clicks LIKE or PASS → POST /api/swipes → card animates out
//   4. Move to the next card (currentIndex + 1)
//   5. When cards run out, fetch the next page
//
// PROFILE FILTERING:
//   The User Service already excludes profiles the user has swiped on
//   (via gRPC call to Swipe Service's GetSwipedUserIds). So every card
//   shown is always a fresh unseen profile.
//
// SWIPE FLOW:
//   LIKE: POST /api/swipes { targetId, direction: 'LIKE' }
//   PASS: POST /api/swipes { targetId, direction: 'PASS' }
//   Both are recorded. Match Service listens for LIKE events on Kafka.
// =============================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { discoverProfiles } from '../api/user';
import { recordSwipe } from '../api/swipe';
import NavBar from '../components/NavBar';
import { CloseIcon, HeartIcon, LogoIcon } from '../components/Icons';
import '../styles/discover.css';

const DiscoverPage = () => {
  const [profiles, setProfiles]         = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [swiping, setSwiping]           = useState(null);  // 'like' | 'pass' | null
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [error, setError]               = useState('');

  // ---------------------------------------------------------------------------
  // loadProfiles — fetch a page of profiles and append to the queue
  // ---------------------------------------------------------------------------
  const loadProfiles = async (pageNum) => {
    try {
      setLoading(true);
      const data = await discoverProfiles(pageNum, 10);
      setProfiles((prev) => [...prev, ...data.profiles]);
      setHasMore(pageNum < data.totalPages);
    } catch (err) {
      setError('Failed to load profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load first page on mount
  useEffect(() => {
    loadProfiles(1);
  }, []);

  // When the user reaches 2 cards from the end, preload the next page
  useEffect(() => {
    const remaining = profiles.length - currentIndex;
    if (remaining === 2 && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadProfiles(nextPage);
    }
  }, [currentIndex, profiles.length, hasMore, loading]);

  // ---------------------------------------------------------------------------
  // handleSwipe — send the swipe to the API, then advance to next card
  // ---------------------------------------------------------------------------
  const handleSwipe = async (direction) => {
    const profile = profiles[currentIndex];
    if (!profile || swiping) return;

    setSwiping(direction === 'LIKE' ? 'like' : 'pass');

    try {
      await recordSwipe(profile.id, direction);
    } catch (err) {
      // 409 = already swiped (shouldn't happen since feed filters these out)
      // Silently continue — advance to next card regardless
      if (err.response?.status !== 409) {
        console.error('Swipe failed:', err.message);
      }
    }

    // Short delay so the swipe animation plays before the card disappears
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSwiping(null);
    }, 300);
  };

  // ---------------------------------------------------------------------------
  // RENDER STATES
  // ---------------------------------------------------------------------------

  const currentProfile = profiles[currentIndex];

  // No profiles left and nothing more to load
  if (!loading && !currentProfile && !hasMore) {
    return (
      <div className="discover-empty">
        <div className="empty-icon">🎉</div>
        <h2>You've seen everyone!</h2>
        <p>Come back later when more developers join DevMatch.</p>
        <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
      </div>
    );
  }

  // Initial loading state
  if (loading && profiles.length === 0) {
    return (
      <div className="discover-loading">
        <div className="spinner" />
        <p>Loading developers...</p>
      </div>
    );
  }

  return (
    <div className="discover-page">
      {/* Header */}
      <div className="discover-header">
        <div className="discover-title">
          <LogoIcon size={22} />
          <span>DevMatch</span>
        </div>
        <span className="discover-count">
          {profiles.length - currentIndex} left
        </span>
      </div>

      {error && <div className="discover-error">{error}</div>}

      {/* Card stack */}
      <div className="card-stack">
        {currentProfile ? (
          <div
            className={`swipe-card ${swiping === 'like' ? 'swiping-like' : ''} ${swiping === 'pass' ? 'swiping-pass' : ''}`}
          >
            {/* Profile photo — name/info overlaid at bottom (Tinder style) */}
            <div className="card-photo">
              {currentProfile.photo_url ? (
                <img src={currentProfile.photo_url} alt={currentProfile.name} />
              ) : (
                <div className="card-photo-placeholder">
                  {currentProfile.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}

              {/* Gradient overlay for readability */}
              <div className="card-photo-overlay" />

              {/* Swipe indicators */}
              {swiping === 'like' && (
                <div className="swipe-indicator like-indicator">LIKE</div>
              )}
              {swiping === 'pass' && (
                <div className="swipe-indicator pass-indicator">NOPE</div>
              )}

              {/* Profile info overlaid on photo */}
              <div className="card-overlay-info">
                <div className="card-name-row">
                  <h2 className="card-name">{currentProfile.name}</h2>
                  {currentProfile.age && (
                    <span className="card-age">{currentProfile.age}</span>
                  )}
                </div>

                {currentProfile.location && (
                  <p className="card-location">📍 {currentProfile.location}</p>
                )}

                {currentProfile.bio && (
                  <p className="card-bio">{currentProfile.bio}</p>
                )}

                {currentProfile.skills?.length > 0 && (
                  <div className="card-skills">
                    {currentProfile.skills.map((skill) => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                )}

                {currentProfile.github_url && (
                  <a
                    href={currentProfile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-github"
                  >
                    GitHub →
                  </a>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="card-actions">
              <button
                className="btn-pass"
                onClick={() => handleSwipe('PASS')}
                disabled={!!swiping}
                aria-label="Pass"
              >
                <CloseIcon size={28} />
              </button>
              <button
                className="btn-like"
                onClick={() => handleSwipe('LIKE')}
                disabled={!!swiping}
                aria-label="Like"
              >
                <HeartIcon size={30} />
              </button>
            </div>
          </div>
        ) : (
          // Loading next page of cards
          <div className="card-loading">
            <div className="spinner" />
            <p>Loading more developers...</p>
          </div>
        )}
      </div>
      <NavBar />
    </div>
  );
};

export default DiscoverPage;
