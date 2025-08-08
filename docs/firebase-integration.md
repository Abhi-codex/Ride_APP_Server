# Firebase Authentication Integration Guide

## Overview

This guide covers the implementation of Firebase Authentication in the ambulance booking backend, providing modern OAuth and SMS OTP functionality with zero additional cost for SMS services.

## Features Implemented

### 1. **Unified Authentication System**
- **Phone OTP**: Real SMS verification through Firebase Auth
- **Google OAuth**: Seamless social login integration
- **Progressive Onboarding**: Role-based phone number requirements
- **No Additional SMS Costs**: Firebase handles SMS delivery

### 2. **User Model Updates**
- `firebaseUid`: Unique identifier from Firebase Auth
- `phoneVerified`: Boolean for phone verification status
- `profileCompleted`: Auto-calculated based on role requirements
- `onboardingStep`: Tracks current onboarding progress
- `authMethods`: Array of authentication methods used (phone, google, email)

### 3. **Authentication Middleware**
- **Firebase-only approach**: Firebase ID token verification required
- **Secure token validation**: Firebase Admin SDK handles JWT validation
- **Socket.io integration**: Maintained for real-time features

### 4. **Role-Based Phone Requirements**
- **Patients & Drivers**: Phone number required and verified via SMS
- **Doctors**: Phone optional, alternative contact methods accepted
- **Progressive Collection**: Users can complete phone verification later

## API Endpoints

### Firebase Authentication Endpoints (`/firebase/`)

```bash
# Verify Firebase ID token and create/login user
POST /firebase/verify-firebase-token
Headers: Content-Type: application/json
Body: {
  "idToken": "firebase-id-token-here",
  "role": "patient|driver|doctor"
}

# Get Firebase user information (debug endpoint)
GET /firebase/firebase-user/:uid
```

### User Profile Endpoints (`/auth/`)

```bash
# Update user profile
PUT /auth/profile
Headers: Authorization: Bearer <firebase-jwt-token>
Body: { name, email, vehicle, hospitalAffiliation }

# Get user profile
GET /auth/profile
Headers: Authorization: Bearer <firebase-jwt-token>

# Refresh JWT tokens
POST /auth/refresh-token
Body: { refresh_token }
```

## Environment Variables

Add these to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./path-to-service-account.json

# Alternative: JSON string format
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Database Configuration
MONGO_URI=mongodb://localhost:27017/ambulance_booking

# JWT Configuration (for custom app tokens after Firebase auth)
ACCESS_TOKEN_SECRET=your_super_secret_access_token_key_here
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key_here
```

## User Schema

All users are created with Firebase integration. The User model includes:

```javascript
{
  firebaseUid: String,        // Required - Firebase user UID
  phone: String,              // Optional - phone number  
  email: String,              // Optional - email address
  name: String,               // Optional - display name
  role: String,               // Required - patient|driver|doctor
  phoneVerified: Boolean,     // Auto-set from Firebase
  profileCompleted: Boolean,  // Auto-calculated based on role
  onboardingStep: String,     // Current step: phone|profile|complete
  authMethods: Array,         // Firebase authentication methods used
  createdAt: Date,
  updatedAt: Date
}
```

## Frontend Integration Patterns

### 1. **Phone OTP Authentication**

```javascript
// Initialize Firebase (Web SDK)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Send OTP
const sendOTP = async (phoneNumber) => {
  const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container');
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  return confirmationResult;
};

// Verify OTP and register with backend
const verifyOTP = async (confirmationResult, otpCode, role) => {
  const result = await confirmationResult.confirm(otpCode);
  const idToken = await result.user.getIdToken();
  
  // Send to backend
  const response = await fetch('/firebase/verify-firebase-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, role })
  });
  
  return response.json();
};
```

### 2. **Google OAuth Authentication**

```javascript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const signInWithGoogle = async (role) => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  
  // Send to backend
  const response = await fetch('/firebase/verify-firebase-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, role })
  });
  
  return response.json();
};
```

### 3. **Progressive Phone Collection**

```javascript
// Check if user needs to complete phone verification
const checkProfileCompletion = (user) => {
  if (!user.profileCompleted) {
    if ((user.role === 'patient' || user.role === 'driver') && !user.phoneVerified) {
      // Show phone collection UI
      return 'phone_required';
    }
  }
  return 'complete';
};
```

## Mobile App Integration

### Android (Kotlin)

```kotlin
// No reCAPTCHA needed for mobile apps
FirebaseAuth.getInstance().signInWithPhoneNumber(
    phoneNumber,
    60,
    TimeUnit.SECONDS,
    this,
    object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
        override fun onVerificationCompleted(credential: PhoneAuthCredential) {
            // Auto verification successful
        }
        
        override fun onCodeSent(verificationId: String, token: PhoneAuthProvider.ForceResendingToken) {
            // OTP sent, show input field
        }
    }
)
```

### iOS (Swift)

```swift
PhoneAuthProvider.provider().verifyPhoneNumber(phoneNumber, uiDelegate: nil) { verificationID, error in
    if let error = error {
        // Handle error
        return
    }
    // OTP sent successfully
}
```

## Architecture Benefits

### 1. **Cost Efficiency**
- **No Twilio costs**: Firebase handles SMS for free (generous quota)
- **No third-party SMS service**: Everything through Firebase
- **Reduced complexity**: Single authentication provider

### 2. **Security & Reliability**
- **Google infrastructure**: Enterprise-grade security
- **Automatic fraud detection**: Built-in spam prevention
- **Global SMS delivery**: Works worldwide
- **Token-based auth**: Secure JWT tokens from Firebase

### 3. **Developer Experience**
- **Unified SDKs**: Same API for web and mobile
- **Real-time user management**: Firebase Auth console
- **Analytics integration**: Firebase Analytics included
- **Easy testing**: Test phone numbers supported

## Current Implementation Status

### ✅ **Firebase-Only Authentication (Current)**
- Firebase handles all authentication (Phone OTP + Google OAuth)
- All new users created through Firebase system
- Clean, modern authentication flow
- Real SMS delivery with zero additional costs
- No legacy authentication code

## Testing

### Backend Testing
```bash
# Test Firebase Admin SDK
node test-firebase-simple.js

# Test SMS capabilities
node test-backend-sms.js
```

### Frontend Testing
- Open `firebase-web-test.html` in browser
- Test phone OTP with real SMS
- Test Google OAuth integration

## Security Considerations

1. **Firebase Service Account**: Securely stored service account keys
2. **Token Validation**: Firebase handles JWT validation automatically
3. **Role Protection**: Middleware checks user roles for authorization
4. **SMS Security**: Firebase handles reCAPTCHA and fraud detection

## Troubleshooting

### Common Issues

1. **Firebase not initialized**:
   - Check `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Verify service account file permissions

2. **SMS not sending**:
   - Enable Phone authentication in Firebase Console
   - Check Firebase project quota
   - Verify phone number format (+country-code)

3. **reCAPTCHA required error**:
   - Only affects web browsers (normal behavior)
   - Mobile apps don't need reCAPTCHA
   - Use proper Firebase Web SDK setup

4. **User not found after Firebase auth**:
   - User created in Firebase but not in your database
   - Check `/firebase/verify-firebase-token` endpoint
   - Ensure role is provided during registration

5. **Profile update issues**:
   - Use Firebase JWT token in Authorization header
   - Token must be valid and not expired
   - Check user permissions for the operation

## Firebase Console Setup

1. **Enable Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Phone" provider
   - Enable "Google" provider (optional)

2. **Configure Phone Auth**:
   - Add test phone numbers (optional)
   - Set SMS quotas and billing

3. **Generate Service Account**:
   - Go to Project Settings → Service accounts
   - Generate new private key
   - Download JSON file

## Support

For issues or questions:
1. Check Firebase Console for user data
2. Verify environment variables are set
3. Test with backend scripts first
4. Review Firebase Auth documentation
5. Check phone number format and quotas
