import { NavLink } from 'react-router-dom';
import { FlameIcon, HeartIcon, PersonIcon } from './Icons';
import '../styles/navbar.css';

const NavBar = () => (
  <nav className="bottom-nav">
    <NavLink to="/discover" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <FlameIcon size={26} />
    </NavLink>
    <NavLink to="/matches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <HeartIcon size={24} />
    </NavLink>
    <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <PersonIcon size={25} />
    </NavLink>
  </nav>
);

export default NavBar;
