# 🔐 Authentication API Documentation

## Base URL
```
http://localhost:3000/auth
```

---

## 📱 Send OTP

### Endpoint
```
POST /auth/send-otp
```

### Description
Generates and sends a 6-digit OTP to the provided phone number. Creates a new user if the phone number doesn't exist.

### Request Body
```json
{
  "phone": "string (required)",     // Phone number with country code
  "role": "string (required)"       // "patient", "doctor", or "driver"
}
```

### Example Request
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "role": "patient"
  }'
```

### Response Codes
- **200 OK**: OTP sent successfully
- **400 Bad Request**: Invalid input or rate limiting
- **500 Internal Server Error**: Server error

### Success Response (200)
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "phone": "1234567890",
  "otp": "123456",              // Only in development mode
  "expiresIn": "10 minutes"
}
```

### Error Response (400)
```json
{
  "success": false,
  "message": "Please wait 60 seconds before requesting another OTP"
}
```

### Validation Rules
- Phone number must be at least 10 digits
- Role must be one of: "patient", "doctor", "driver"
- Rate limit: 1 OTP per phone number per 60 seconds
- OTP expires after 10 minutes

---

## ✅ Verify OTP

### Endpoint
```
POST /auth/verify-otp
```

### Description
Verifies the OTP code and returns JWT tokens for authentication. Creates role-specific profile if verification succeeds.

### Request Body
```json
{
  "phone": "string (required)",     // Phone number (formatted automatically)
  "otp": "string (required)"        // 6-digit OTP code
}
```

### Example Request
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "otp": "123456"
  }'
```

### Response Codes
- **200 OK**: OTP verified successfully
- **400 Bad Request**: Invalid OTP, expired, or too many attempts
- **404 Not Found**: Phone number not found
- **500 Internal Server Error**: Server error

### Success Response (200)
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "user": {
    "_id": "user_id_here",
    "phone": "1234567890",
    "role": "patient",
    "phoneVerified": true,
    "profileCompleted": false,
    "createdAt": "2025-08-24T12:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "profile": {
    // Role-specific profile data
    // For patient: Patient model instance
    // For doctor: Doctor model instance  
    // For driver: Driver model instance
  }
}
```

### Error Responses

#### Invalid/Expired OTP (400)
```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

#### Too Many Attempts (400)
```json
{
  "success": false,
  "message": "Too many OTP verification attempts. Please request a new OTP."
}
```

#### Phone Not Found (404)
```json
{
  "success": false,
  "message": "No OTP request found for this phone number"
}
```

### Validation Rules
- OTP must be exactly 6 digits
- OTP expires after 10 minutes
- Maximum 5 verification attempts per OTP
- After 5 failed attempts, new OTP must be requested

---

## 🔑 Using JWT Tokens

### Access Token
- **Purpose**: Authenticate API requests
- **Expiry**: 15 minutes (configurable)
- **Usage**: Include in Authorization header

### Refresh Token
- **Purpose**: Generate new access tokens
- **Expiry**: 7 days (configurable)
- **Usage**: Store securely, use to refresh access tokens

### Authentication Header
```javascript
Headers: {
  "Authorization": "Bearer <access_token>",
  "Content-Type": "application/json"
}
```

### Example Authenticated Request
```bash
curl -X GET http://localhost:3000/patient/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

---

## 🔄 Token Refresh (Implementation Pending)

### Endpoint
```
POST /auth/refresh-token
```

### Request Body
```json
{
  "refreshToken": "string (required)"
}
```

### Success Response
```json
{
  "success": true,
  "accessToken": "new_access_token_here",
  "refreshToken": "new_refresh_token_here"
}
```

---

## 📝 Security Features

### Rate Limiting
- **OTP Requests**: 1 per phone number per 60 seconds
- **Verification Attempts**: Maximum 5 per OTP

### Token Security
- **JWT Signing**: Uses strong secrets from environment variables
- **Token Expiry**: Short-lived access tokens, longer-lived refresh tokens
- **Secure Storage**: Tokens should be stored securely on client side

### OTP Security
- **6-digit codes**: Sufficient entropy for security
- **Time-based expiry**: 10-minute window
- **Attempt limiting**: Prevents brute force attacks
- **Phone validation**: Ensures proper phone number format

### Data Validation
- **Input sanitization**: All inputs are validated and sanitized
- **Phone formatting**: Automatic formatting and validation
- **Role validation**: Strict role checking
- **MongoDB injection protection**: Mongoose provides built-in protection

---

## 🐛 Error Handling

### HTTP Status Codes
- **200**: Success
- **400**: Bad Request (validation errors, rate limiting)
- **401**: Unauthorized (invalid tokens)
- **404**: Not Found (phone number not found)
- **500**: Internal Server Error

### Error Response Format
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

### Common Error Messages
- `"Phone number and role are required"`
- `"Invalid role. Must be patient, driver, or doctor"`
- `"Invalid phone number format"`
- `"Please wait 60 seconds before requesting another OTP"`
- `"Invalid or expired OTP"`
- `"Too many OTP verification attempts. Please request a new OTP."`
- `"No OTP request found for this phone number"`

---

## 🔧 Environment Configuration

### Required Variables
```bash
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
MONGO_URI=your_mongodb_connection_string
```

### Optional Variables
```bash
NODE_ENV=development    # Enables OTP in response for testing
PORT=3000              # Server port
```

---

## 📊 Database Schema

### User Model (OTP Fields)
```javascript
{
  phone: String (required, unique),
  role: String (required, enum: ["patient", "driver", "doctor", "hospital_staff"]),
  otp: String (nullable),
  otpExpiry: Date (nullable),
  otpAttempts: Number (default: 0),
  lastOtpSent: Date (nullable),
  phoneVerified: Boolean (default: false),
  profileCompleted: Boolean (default: false)
}
```

---

*This documentation covers the complete authentication API for the new OTP-based system.*
