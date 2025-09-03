# 🚀 Quick Reference: New OTP Authentication System

## 📋 Quick Start

### 1. Send OTP
POST /auth/send-otp
{
  "phone": "+1234567890",
  "role": "patient" // "doctor", "driver", "patient"
}


### 2. Verify OTP
POST /auth/verify-otp
{
  "phone": "+1234567890",
  "otp": "123456"
}


### 3. Authenticated Requests
Headers: {
  "Authorization": "Bearer <access_token>",
  "Content-Type": "application/json"
}


---

## 🔧 Frontend Integration (React Native)

// 1. OTP Functions
const sendOTP = async (phone, role) => {
  const response = await fetch(`${API_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, role })
  });
  return response.json();
};

const verifyOTP = async (phone, otp) => {
  const response = await fetch(`${API_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp })
  });
  const data = await response.json();
  
  if (data.success) {
    // Store tokens
    await AsyncStorage.setItem('accessToken', data.tokens.accessToken);
    await AsyncStorage.setItem('refreshToken', data.tokens.refreshToken);
  }
  return data;
};

// 2. Authenticated API calls
const apiCall = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('accessToken');
  
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};


---

## 🔑 Key Features

| Feature | Description |
|---------|-------------|
| **OTP Generation** | 6-digit codes, 10-minute expiry |
| **Rate Limiting** | 60-second cooldown between requests |
| **Attempt Tracking** | Max 5 verification attempts per OTP |
| **JWT Tokens** | Access (15min) + Refresh (7 days) |
| **Role-based Auth** | Patient, Doctor, Driver profiles |
| **Phone Validation** | Automatic formatting and validation |

---

## 🐛 Quick Troubleshooting

| Error | Solution |
|-------|----------|
| `name required` | Name is now optional - restart server |
| `Invalid phone format` | Use +1234567890 format |
| `Wait 60 seconds` | Rate limiting active |
| `OTP expired` | Request new OTP (10min expiry) |
| `JWT verification failed` | Check ACCESS_TOKEN_SECRET in .env |
| `Too many attempts` | Max 5 attempts per OTP |

---

## 📝 Required Environment Variables

bash
# Essential for JWT authentication
ACCESS_TOKEN_SECRET=your_secret_key
REFRESH_TOKEN_SECRET=your_refresh_secret
MONGO_URI=your_mongodb_connection_string


---

## 🔄 Migration Checklist

- [ ] Remove Firebase imports
- [ ] Update authentication functions
- [ ] Update API endpoints
- [ ] Test OTP flow
- [ ] Verify token storage
- [ ] Test authenticated requests

