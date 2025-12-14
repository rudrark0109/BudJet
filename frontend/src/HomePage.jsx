import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Fetch user profile from backend
        try {
          const response = await fetch(`http://localhost:5000/api/auth/user/${currentUser.uid}`);
          if (response.ok) {
            const data = await response.json();
            setProfile(data);
          }
        } catch (err) {
          console.error('Failed to fetch profile:', err);
        }
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/');
  }

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Welcome to BudJet</h1>
      <p>Logged in as: {user.email || 'Anonymous'}</p>
      {profile && (
        <>
          <p>Display Name: {profile.display_name || 'Not set'}</p>
          <p>Member since: {new Date(profile.created_at).toLocaleDateString()}</p>
        </>
      )}
      <p>User ID: {user.uid}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
