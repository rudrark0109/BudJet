import { User } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-logo">
          <div className="navbar-logo-icon"></div>
          <span className="navbar-logo-text">BudJet</span>
        </div>
        
        <div className="navbar-user">
          <p className="navbar-user-name">John Doe</p>
          <div className="navbar-user-avatar">
            <User />
          </div>
        </div>
      </div>
    </nav>
  );
}
