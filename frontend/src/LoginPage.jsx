import { useState } from 'react';
import { auth, googleProvider, githubProvider } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { registerUser } from './api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  async function handleRegister(e) {
    e.preventDefault();
    setStatus('Registering...');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Register user in backend database
      await registerUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || email.split('@')[0],
      });
      
      setStatus('Registered and logged in! Redirecting...');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setStatus('Logging in...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus('Logged in! Redirecting...');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleGoogle() {
    setStatus('Signing in with Google...');
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      
      // Register/login user in backend
      await registerUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      
      setStatus('Signed in! Redirecting...');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleGithub() {
    setStatus('Signing in with GitHub...');
    try {
      const userCredential = await signInWithPopup(auth, githubProvider);
      const user = userCredential.user;
      
      // Register/login user in backend
      await registerUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      
      setStatus('Signed in! Redirecting...');
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>BudJet Login</h1>

      <form onSubmit={handleLogin} style={{ marginBottom: '1rem' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
          required
        />
        <button type="submit">Login</button>
      </form>

      <button onClick={handleRegister} style={{ marginRight: '0.5rem' }}>
        Register
      </button>
      <button onClick={handleGoogle} style={{ marginRight: '0.5rem' }}>
        Sign in with Google
      </button>
      <button onClick={handleGithub} style={{ marginRight: '0.5rem' }}>
        Sign in with GitHub
      </button>

      <p style={{ marginTop: '1rem' }}>{status}</p>
    </div>
  );
}
