import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase Admin
let firebaseInitialized = false;

try {
  let serviceAccount;
  
  // Load Firebase configuration from environment variables
  if (process.env.FIREBASE_PROJECT_ID && 
      process.env.FIREBASE_PRIVATE_KEY && 
      process.env.FIREBASE_CLIENT_EMAIL) {
    
    console.log('� Loading Firebase service account from environment variables');
    
    serviceAccount = {
      type: process.env.FIREBASE_TYPE || 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
    };
    
    console.log('✅ Firebase service account loaded from environment variables successfully');
    console.log('🔥 Project ID:', serviceAccount.project_id);
    
  } else {
    throw new Error('Required Firebase environment variables are missing. Please check FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your .env file');
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });

  firebaseInitialized = true;
  console.log('🚀 Firebase Admin SDK initialized successfully');
  console.log('📱 SMS and OAuth ready via Firebase Authentication');
  
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  console.error('Please check your Firebase configuration in .env file');
}

// Firebase Auth middleware
export const firebaseAuth = async (req, res, next) => {
  try {
    if (!firebaseInitialized) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add Firebase user info to request
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      phone: decodedToken.phone_number,
      emailVerified: decodedToken.email_verified,
      phoneVerified: decodedToken.phone_number ? true : false
    };
    
    next();
  } catch (error) {
    console.error('Firebase auth error:', error);
    return res.status(401).json({ error: 'Invalid Firebase token' });
  }
};

// Helper function to get Firebase user
export const getFirebaseUser = (req) => {
  return req.firebaseUser || null;
};

// Helper function to verify Firebase phone number
export const verifyPhoneNumber = async (phoneNumber, verificationCode) => {
  try {
    // This would be handled on the client side with Firebase Auth
    // Backend verification is done through ID tokens
    return true;
  } catch (error) {
    console.error('Error verifying phone number:', error);
    return false;
  }
};

// Export Firebase admin for use in other files
export { admin as firebaseAdmin };
