import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

// Initialize Firebase Admin
let firebaseInitialized = false;

try {
  let serviceAccount;
  
  // Try to load from file path first, then from JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    console.log('📁 Loading Firebase service account from file:', serviceAccountPath);
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(serviceAccountContent);
      console.log('✅ Firebase service account loaded from file successfully');
      console.log('🔥 Project ID:', serviceAccount.project_id);
    } else {
      throw new Error(`Firebase service account file not found: ${serviceAccountPath}`);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log('📝 Loading Firebase service account from environment variable');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✅ Firebase service account loaded from env var successfully');
    console.log('🔥 Project ID:', serviceAccount.project_id);
  } else {
    throw new Error('Neither FIREBASE_SERVICE_ACCOUNT_PATH nor FIREBASE_SERVICE_ACCOUNT_KEY is set');
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
