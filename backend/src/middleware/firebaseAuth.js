import admin from 'firebase-admin';
import { createRequire } from 'module';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);

let firebaseReady = false;
let useRestFallback = false;

function buildCredential() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    return admin.credential.cert(require(serviceAccountPath));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || (process.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }

  return null;
}

export function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    firebaseReady = true;
    return;
  }

  const credential = buildCredential();

  if (!credential) {
    const apiKey = (process.env.VITE_FIREBASE_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('No Firebase credentials configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or VITE_FIREBASE_API_KEY.');
    }
    console.log('Firebase Admin: no service account found — using REST API token verification');
    useRestFallback = true;
    firebaseReady = true;
    return;
  }

  admin.initializeApp({ credential });
  firebaseReady = true;
}

async function verifyWithRestApi(token) {
  const apiKey = (process.env.VITE_FIREBASE_API_KEY || '').trim();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Token verification failed');
  }

  const data = await res.json();
  const user = data.users?.[0];
  if (!user) throw new Error('Invalid token');

  return { uid: user.localId, email: user.email, name: user.displayName };
}

export async function verifyFirebaseToken(req, res, next) {
  if (!firebaseReady) {
    return res.status(500).json({ error: 'Firebase Admin is not initialized.' });
  }

  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization bearer token' });
  }

  try {
    const decoded = useRestFallback
      ? await verifyWithRestApi(token)
      : await admin.auth().verifyIdToken(token);
    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired Firebase token' });
  }
}

export function requireParamUidMatch(paramName = 'userId') {
  return (req, res, next) => {
    const paramUid = req.params[paramName];
    if (!paramUid || paramUid !== req.auth?.uid) {
      return res.status(403).json({ error: 'Forbidden: user scope mismatch' });
    }
    return next();
  };
}

export function requireBodyUidMatch(fieldName = 'user_id') {
  return (req, res, next) => {
    const tokenUid = req.auth?.uid;
    const bodyUid = req.body?.[fieldName];

    if (!tokenUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (bodyUid && bodyUid !== tokenUid) {
      return res.status(403).json({ error: 'Forbidden: user scope mismatch' });
    }

    if (!req.body) {
      req.body = {};
    }
    req.body[fieldName] = tokenUid;

    return next();
  };
}
