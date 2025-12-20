import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import LoginPage from './LoginPage';
import HomePage from './HomePage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Store user ID in localStorage for API calls
        localStorage.setItem('uid', currentUser.uid);
        localStorage.setItem('userId', currentUser.uid);
        setUser(currentUser);
      } else {
        localStorage.removeItem('uid');
        localStorage.removeItem('userId');
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="main-container">
        <div className="gradient-blob"></div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          color: '#fff'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to="/home" replace /> : <LoginPage />} 
      />
      <Route 
        path="/home" 
        element={user ? <HomePage user={user} /> : <Navigate to="/" replace />} 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}