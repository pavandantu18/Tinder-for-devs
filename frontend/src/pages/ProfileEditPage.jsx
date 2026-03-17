// =============================================================================
// src/pages/ProfileEditPage.jsx
// Project: DevMatch Frontend
//
// PURPOSE:
//   Allows users to fill in and update their developer profile.
//   Loaded on first login (profile is blank) and accessible from dashboard.
//
// DATA FLOW:
//   1. On mount: GET /api/users/me → populate form with existing values
//   2. On save:  PUT /api/users/me → send only changed fields
//   3. On success: show success message, update local state
//
// PROFILE COMPLETION:
//   A profile needs name + at least one skill to be "complete".
//   Complete profiles appear in other users' discovery feed.
//   We show a completion status badge so the user knows what's required.
// =============================================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyProfile, updateMyProfile } from '../api/user';
import { useAuth } from '../context/AuthContext';
import '../styles/profile.css';

const ProfileEditPage = () => {
  // Form fields — initialized empty, populated from API on mount
  const [name,      setName]      = useState('');
  const [bio,       setBio]       = useState('');
  const [skills,    setSkills]    = useState([]);    // array of strings
  const [skillInput,setSkillInput]= useState('');    // text in the skill input box
  const [githubUrl, setGithubUrl] = useState('');
  const [photoUrl,  setPhotoUrl]  = useState('');
  const [age,       setAge]       = useState('');
  const [location,  setLocation]  = useState('');

  const [isComplete, setIsComplete] = useState(false);
  const [loading,    setLoading]    = useState(true);   // loading profile on mount
  const [saving,     setSaving]     = useState(false);  // saving profile
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Load existing profile on mount ────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { profile } = await getMyProfile();
        // Pre-fill form with whatever exists (null fields stay as empty string)
        setName(profile.name       || '');
        setBio(profile.bio         || '');
        setSkills(profile.skills   || []);
        setGithubUrl(profile.github_url || '');
        setPhotoUrl(profile.photo_url   || '');
        setAge(profile.age         ? String(profile.age) : '');
        setLocation(profile.location   || '');
        setIsComplete(profile.is_complete || false);
      } catch (err) {
        // Profile might not exist yet if Kafka event is still processing
        if (err.response?.status !== 404) {
          setError('Failed to load profile. Please refresh.');
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  // ── Skills management ─────────────────────────────────────────────────────
  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (skills.includes(trimmed)) {
      setSkillInput('');
      return; // Don't add duplicates
    }
    if (skills.length >= 20) {
      setError('Maximum 20 skills allowed.');
      return;
    }
    setSkills([...skills, trimmed]);
    setSkillInput('');
  };

  const removeSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Allow pressing Enter in skill input to add the skill
  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Don't submit the form
      addSkill();
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    setSaving(true);
    try {
      const { profile } = await updateMyProfile({
        name:       name.trim(),
        bio:        bio.trim(),
        skills,
        github_url: githubUrl.trim() || null,
        photo_url:  photoUrl.trim()  || null,
        age:        age ? parseInt(age) : null,
        location:   location.trim()  || null,
      });

      setIsComplete(profile.is_complete);
      setSuccess('Profile saved successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const message = err.response?.data?.error
        || err.response?.data?.errors?.join(', ')
        || 'Failed to save profile.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <p style={{ color: '#888' }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">

      {/* Nav */}
      <div className="profile-nav">
        <h2>Edit Profile</h2>
        <Link to="/dashboard" className="btn-ghost">← Dashboard</Link>
      </div>

      <div className="profile-card">

        {/* Avatar + status */}
        <div className="avatar-section">
          <div className="avatar">
            {photoUrl
              ? <img src={photoUrl} alt={name || 'Profile'} />
              : '💻'}
          </div>
          <div className="avatar-info">
            <h3>{name || user?.email || 'New Developer'}</h3>
            <p style={{ marginBottom: 8 }}>{user?.email}</p>
            {isComplete
              ? <span className="complete-badge">✓ Profile visible in discover</span>
              : <span className="incomplete-badge">⚠ Add name + skill to appear in discover</span>
            }
          </div>
        </div>

        {/* Form */}
        <form className="profile-form" onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="name">Display Name *</label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              rows={3}
              placeholder="Tell other developers about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
            />
            <span className="char-count">{bio.length}/500</span>
          </div>

          {/* Skills — tag-based input */}
          <div className="form-group">
            <label>Skills * (add at least one)</label>
            <div className="skills-input-row">
              <input
                type="text"
                placeholder="e.g. React, Node.js, Go..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                maxLength={30}
              />
              <button
                type="button"
                className="btn-add-skill"
                onClick={addSkill}
                title="Add skill"
              >+</button>
            </div>
            {/* Render existing skills as removable tags */}
            {skills.length > 0 && (
              <div className="skills-tags">
                {skills.map((skill) => (
                  <span key={skill} className="skill-tag">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      title={`Remove ${skill}`}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="github">GitHub URL</label>
            <input
              id="github"
              type="url"
              placeholder="https://github.com/yourusername"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="photo">Profile Photo URL</label>
            <input
              id="photo"
              type="url"
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>

          {/* Age and location in a row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div className="form-group">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                type="number"
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={18}
                max={100}
              />
            </div>
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                type="text"
                placeholder="San Francisco, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          {error   && <div className="profile-error">{error}</div>}
          {success && <div className="profile-success">{success}</div>}

          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

        </form>
      </div>
    </div>
  );
};

export default ProfileEditPage;
