// src/components/NavBar.jsx — bottom tab navigation (Tinder-style)
import { NavLink } from 'react-router-dom';
import '../styles/navbar.css';

const NavBar = () => (
  <nav className="bottom-nav">
    <NavLink to="/discover" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon">🔥</span>
      <span className="nav-label">Discover</span>
    </NavLink>
    <NavLink to="/matches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon">❤️</span>
      <span className="nav-label">Matches</span>
    </NavLink>
    <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon">👤</span>
      <span className="nav-label">Profile</span>
    </NavLink>
  </nav>
);

export default NavBar;
