# 🔄 Firebase to Backend OTP Migration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [API Endpoint Changes](#api-endpoint-changes)
4. [Frontend Integration](#frontend-integration)
5. [Environment Variables](#environment-variables)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide helps you migrate from Firebase Authentication to our new **pure backend OTP authentication system**. The new system eliminates Firebase dependencies and provides a simpler, more reliable authentication flow.

### Why We Migrated
- ❌ **Firebase Issues**: Complex setup, reCAPTCHA problems in Expo builds
- ❌ **Production Complexity**: Multiple configuration files and environment variables
- ❌ **Third-party Dependencies**: Reliance on external services
- ✅ **New Benefits**: Simple backend-only solution, existing OTP utilities, better control

---

## 🔧 What Changed

### Removed Components
- `config/firebase.js` - Firebase configuration
- `routes/firebaseAuthentication.js` - Firebase auth routes
- `firebase-admin` npm package
- Firebase environment variables
- Firebase middleware and validation

### Added Components
- Enhanced `models/User.js` with OTP fields
- Rewritten `controllers/auth.js` with OTP functions
- Updated `middleware/authentication.js` for JWT-only auth
- `bcryptjs` for password hashing
- Pure backend OTP generation using existing utilities

---

## 🚀 API Endpoint Changes

### ❌ Old Firebase Endpoints (REMOVED)
```bash
# These endpoints no longer exist
POST /firebase-auth/send-otp
POST /firebase-auth/verify-otp
POST /firebase-auth/refresh-token
```

### ✅ New Backend OTP Endpoints

#### 1. Send OTP
```bash
POST /auth/send-otp
Content-Type: application/json

{
  "phone": "+1234567890",
  "role": "patient" // "doctor", "driver", or "patient"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "phone": "1234567890",
  "otp": "123456", // Only in development mode
  "expiresIn": "10 minutes"
}
```

#### 2. Verify OTP
```bash
POST /auth/verify-otp
Content-Type: application/json

{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "user": {
    "id": "user_id",
    "phone": "1234567890",
    "role": "patient",
    "profileCompleted": false
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  },
  "profile": {
    // Role-specific profile data
  }
}
```

---

## 📱 Frontend Integration

### React Native / Expo Changes

#### ❌ Old Firebase Code
```javascript
// Remove these imports
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Remove Firebase initialization
const firebaseConfig = { ... };
firebase.initializeApp(firebaseConfig);
```

#### ✅ New API Integration
```javascript
// 1. Send OTP Function
const sendOTP = async (phone, role) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, role }),
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Send OTP Error:', error);
    throw error;
  }
};

// 2. Verify OTP Function
const verifyOTP = async (phone, otp) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, otp }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Store tokens securely
      await AsyncStorage.setItem('accessToken', data.tokens.accessToken);
      await AsyncStorage.setItem('refreshToken', data.tokens.refreshToken);
      
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Verify OTP Error:', error);
    throw error;
  }
};

// 3. Make Authenticated Requests
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = await AsyncStorage.getItem('accessToken');
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};
```

### Authentication Flow Update
```javascript
// Complete authentication flow
const handlePhoneAuth = async (phone, role) => {
  try {
    // 1. Send OTP
    setLoading(true);
    const otpResponse = await sendOTP(phone, role);
    
    if (otpResponse.success) {
      setShowOTPInput(true);
      setMessage('OTP sent to your phone');
    }
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};

const handleOTPVerification = async (otp) => {
  try {
    setLoading(true);
    const verifyResponse = await verifyOTP(phone, otp);
    
    if (verifyResponse.success) {
      // Navigation based on profile completion
      if (verifyResponse.user.profileCompleted) {
        navigation.navigate('Dashboard');
      } else {
        navigation.navigate('ProfileCompletion');
      }
    }
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 🔧 Environment Variables

### ❌ Remove Firebase Variables
```bash
# Remove these from your .env file
FIREBASE_PROJECT_ID=
FIREBASE_TYPE=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_AUTH_URI=
FIREBASE_TOKEN_URI=
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=
FIREBASE_CLIENT_X509_CERT_URL=
FIREBASE_UNIVERSE_DOMAIN=
```

### ✅ Required Variables
```bash
# Database Configuration
MONGO_URI=mongodb://localhost:27017/ambulance_booking

# JWT Configuration (REQUIRED)
ACCESS_TOKEN_SECRET=your_super_secret_access_token_key_here
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key_here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: SMS Service (for production)
# SMS_API_KEY=your_sms_service_api_key
# SMS_SENDER_ID=INSTAID
```

---

## 🧪 Testing Guide

### 1. Test OTP Generation
```bash
# Send OTP Request
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890","role":"patient"}'

# Expected Response:
{
  "success": true,
  "message": "OTP sent successfully",
  "phone": "1234567890",
  "otp": "123456", // Only in development
  "expiresIn": "10 minutes"
}
```

### 2. Test OTP Verification
```bash
# Verify OTP Request
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456"}'

# Expected Response:
{
  "success": true,
  "message": "OTP verified successfully",
  "user": { ... },
  "tokens": { ... }
}
```

### 3. Test Authenticated Requests
```bash
# Use the access token from verification response
curl -X GET http://localhost:3000/patient/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "User validation failed: name: Path \`name\` is required"
**Solution**: The User model was updated to make `name` optional during initial registration.
```javascript
// In User model, name is now optional
name: { type: String, default: null },
```

#### 2. "Invalid phone number format"
**Solution**: Ensure phone numbers are properly formatted:
```javascript
// Backend automatically formats phone numbers
const formattedPhone = phone.replace(/\D/g, ''); // Removes non-digits
```

#### 3. "Please wait 60 seconds before requesting another OTP"
**Solution**: Rate limiting is in place. Wait 60 seconds between OTP requests for the same phone number.

#### 4. "OTP expired or invalid"
**Solutions**:
- OTP expires after 10 minutes
- Maximum 5 verification attempts per OTP
- Ensure you're using the latest OTP sent

#### 5. "JWT token verification failed"
**Solutions**:
- Ensure `ACCESS_TOKEN_SECRET` is set in environment variables
- Check if token is properly included in Authorization header
- Verify token hasn't expired (15-minute default expiry)

### Migration Checklist

- [ ] Remove Firebase configuration files
- [ ] Update frontend authentication code
- [ ] Update environment variables
- [ ] Test OTP generation endpoint
- [ ] Test OTP verification endpoint
- [ ] Test authenticated requests
- [ ] Update user registration flow
- [ ] Test profile completion flow
- [ ] Verify token refresh mechanism
- [ ] Update error handling

---

## 📞 Support

If you encounter issues during migration:

1. **Check Server Logs**: Look for detailed error messages
2. **Verify Environment Variables**: Ensure all required variables are set
3. **Test with Postman**: Use the provided curl commands to test endpoints
4. **Database Connection**: Ensure MongoDB connection is working

### Key Benefits After Migration

✅ **Simplified Setup**: No complex Firebase configuration  
✅ **Better Control**: Full control over authentication flow  
✅ **No External Dependencies**: Everything runs on your backend  
✅ **Easier Debugging**: Clear error messages and logs  
✅ **Production Ready**: No reCAPTCHA or build issues  

---

*Migration completed successfully! Your authentication system is now fully backend-driven with reliable OTP verification.*
