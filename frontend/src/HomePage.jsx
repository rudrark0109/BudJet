import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
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
      <p>User ID: {user.uid}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
