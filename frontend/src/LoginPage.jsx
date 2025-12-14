import { useState } from 'react';
import { auth, googleProvider, githubProvider } from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    setStatus('Registering...');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setStatus('Registered and logged in');
      navigate('/home');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setStatus('Logging in...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus('Logged in');
      navigate('/home');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleGoogle() {
    setStatus('Signing in with Google...');
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/home');
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleGithub() {
    setStatus('Signing in with GitHub...');
    try {
      await signInWithPopup(auth, githubProvider);
      navigate('/home');
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
