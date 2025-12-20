import { User, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchUserProfile } from '../api/auth';
import { getUserId } from '../api/client';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export function Navbar() {
  const [username, setUsername] = useState('User');
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    
    (async () => {
      try {
        const profile = await fetchUserProfile(userId);
        setUsername(profile?.display_name || profile?.email || 'User');
      } catch (err) {
        console.warn('Failed to load user profile:', err.message);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-logo">
          <div className="navbar-logo-icon"></div>
          <span className="navbar-logo-text">BudJet</span>
        </div>
        
        <div className="navbar-user" style={{ position: 'relative' }}>
          <p className="navbar-user-name">{username}</p>
          <div 
            className="navbar-user-avatar" 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ cursor: 'pointer' }}
          >
            <User />
          </div>
          
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '8px',
              minWidth: '150px',
              zIndex: 1000,
            }}>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => e.target.style.background = '#334155'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
