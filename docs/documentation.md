# Complete Ambulance Booking System API Documentation

This is the comprehensive documentation for the Emergency Medical Services (Ambulance) Booking System backend API.

## 🚑 System Overview

This system has been converted from a ride-booking platform to a specialized ambulance booking system for emergency medical services. The system supports:

- **Patients**: Users who need emergency medical transport
- **Drivers**: Ambulance drivers with EMT certifications
- **Real-time tracking**: Live location updates and status changes
- **Multiple ambulance types**: From basic to air ambulances
- **Rating system**: Service quality feedback

## 🔧 Technical Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO for live updates
- **Authentication**: JWT tokens (Access + Refresh)
- **Distance Calculation**: Haversine formula
- **Deployment**: Supports both local and network access

## 🌐 Base URLs

- **Local**: `http://localhost:3000`
- **Network**: `http://192.168.31.49:3000`
- **Health Check**: `/health`
- **Database Status**: `/db-status`

## 🔐 Authentication System

### Authentication Endpoints

#### 1. Sign In / Register
**POST** `/auth/signin`

Handles both registration and login for users.

**Request Body:**
```json
{
  "phone": "+1234567890",
  "role": "patient"
}
```

**Valid Roles:**
- `patient` - Users requesting emergency medical transport
- `driver` - Ambulance drivers/EMTs

**Response:**
```json
{
  "message": "User created successfully", // or "User logged in successfully"
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "phone": "+1234567890",
    "role": "patient",
    "name": null,
    "email": null,
    "isOnline": false,
    "vehicle": null,
    "createdAt": "2021-07-21T10:30:00.000Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 2. Refresh Access Token
**POST** `/auth/refresh-token`

Generates new access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. Update User Profile
**PUT** `/auth/profile`

Updates user profile with detailed information. (Requires authentication)

**Request Body for Patient:**
```json
{
  "name": "John Patient",
  "email": "john.patient@email.com"
}
```

**Request Body for Driver:**
```json
{
  "name": "Dr. Sarah EMT",
  "email": "sarah.emt@hospital.com",
  "vehicle": {
    "type": "advancedAmbulance",
    "plateNumber": "AMB123",
    "model": "Mercedes Sprinter",
    "licenseNumber": "EMT-123456",
    "certificationLevel": "EMT-Paramedic"
  }
}
```

**Valid Ambulance Types:**
- `basicAmbulance`
- `advancedAmbulance`
- `icuAmbulance`
- `airAmbulance`

**Valid Certification Levels:**
- `EMT-Basic`
- `EMT-Intermediate`
- `EMT-Paramedic`
- `Critical Care`

**Response:**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "phone": "+1234567890",
    "role": "driver",
    "name": "Dr. Sarah EMT",
    "email": "sarah.emt@hospital.com",
    "isOnline": false,
    "vehicle": {
      "type": "advancedAmbulance",
      "plateNumber": "AMB123",
      "model": "Mercedes Sprinter",
      "licenseNumber": "EMT-123456",
      "certificationLevel": "EMT-Paramedic"
    },
    "createdAt": "2021-07-21T10:30:00.000Z",
    "updatedAt": "2021-07-21T11:00:00.000Z"
  }
}
```

#### 4. Get User Profile
**GET** `/auth/profile`

Retrieves current user's profile information. (Requires authentication)

**Response:**
```json
{
  "message": "Profile retrieved successfully",
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "phone": "+1234567890",
    "role": "driver",
    "name": "Dr. Sarah EMT",
    "email": "sarah.emt@hospital.com",
    "isOnline": false,
    "vehicle": {
      "type": "advancedAmbulance",
      "plateNumber": "AMB123",
      "model": "Mercedes Sprinter",
      "licenseNumber": "EMT-123456",
      "certificationLevel": "EMT-Paramedic"
    },
    "createdAt": "2021-07-21T10:30:00.000Z",
    "updatedAt": "2021-07-21T11:00:00.000Z"
  }
}
```

### Authentication Headers
All protected endpoints require:
```
Authorization: Bearer <your_access_token>
```

## 🚨 Emergency Call Management

All emergency call endpoints are prefixed with `/ride` and require authentication.

### 1. Create Emergency Call
**POST** `/ride/create`

Creates a new emergency call request (Patients only).

**Request Body:**
```json
{
  "vehicle": "advancedAmbulance",
  "pickup": {
    "address": "123 Emergency St",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "drop": {
    "address": "City General Hospital",
    "latitude": 40.7589,
    "longitude": -73.9851
  }
}
```

**Valid Ambulance Types:**
- `basicAmbulance` - Basic life support (₹50 base + ₹15/km)
- `advancedAmbulance` - Advanced life support (₹80 base + ₹20/km)
- `icuAmbulance` - Intensive care (₹120 base + ₹30/km)
- `airAmbulance` - Air medical transport (₹500 base + ₹100/km)

**Response:**
```json
{
  "message": "Emergency call created successfully",
  "ride": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "vehicle": "advancedAmbulance",
    "distance": 15.5,
    "fare": 390,
    "pickup": {
      "address": "123 Emergency St",
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "drop": {
      "address": "City General Hospital",
      "latitude": 40.7589,
      "longitude": -73.9851
    },
    "customer": "60f7b3b3b3b3b3b3b3b3b3b4",
    "rider": null,
    "status": "SEARCHING_FOR_RIDER",
    "otp": "1234",
    "rating": null,
    "createdAt": "2021-07-21T10:30:00.000Z"
  }
}
```

### 2. Accept Emergency Call (Driver Only)
**PATCH** `/ride/accept/:rideId`

Allows an ambulance driver to accept an emergency call.

**Response:**
```json
{
  "message": "Emergency call accepted successfully",
  "ride": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "START",
    "rider": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
      "name": "Dr. Smith",
      "phone": "+1234567890"
    }
  }
}
```

### 3. Update Emergency Call Status
**PATCH** `/ride/update/:rideId`

Updates the status of an emergency call.

**Request Body:**
```json
{
  "status": "ARRIVED"
}
```

**Valid statuses:**
- `START` - Driver has started towards pickup location
- `ARRIVED` - Driver has arrived at pickup location
- `COMPLETED` - Emergency call completed

**Response:**
```json
{
  "message": "Emergency call status updated to ARRIVED",
  "ride": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "ARRIVED",
    "customer": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "name": "John Patient",
      "phone": "+0987654321"
    },
    "rider": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
      "name": "Dr. Smith",
      "phone": "+1234567890"
    }
  }
}
```

### 4. Get My Emergency Calls
**GET** `/ride/rides`

Retrieves emergency calls for the authenticated user (both as patient and driver).

**Query Parameters:**
- `status` (optional): Filter by status

**Response:**
```json
{
  "message": "Emergency calls retrieved successfully",
  "count": 5,
  "rides": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "vehicle": "advancedAmbulance",
      "distance": 15.5,
      "fare": 390,
      "status": "COMPLETED",
      "rating": 5,
      "customer": {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
        "name": "John Patient",
        "phone": "+0987654321"
      },
      "rider": {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
        "name": "Dr. Smith",
        "phone": "+1234567890"
      },
      "createdAt": "2021-07-21T10:30:00.000Z"
    }
  ]
}
```

### 5. Get Available Emergency Calls (Driver Only)
**GET** `/ride/driverrides`

Retrieves emergency calls available for assignment to drivers.

**Response:**
```json
{
  "message": "Available emergency calls retrieved successfully",
  "count": 3,
  "rides": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "vehicle": "icuAmbulance",
      "distance": 8.2,
      "fare": 446,
      "pickup": {
        "address": "456 Emergency Ave",
        "latitude": 40.7300,
        "longitude": -74.0100
      },
      "drop": {
        "address": "Metro Medical Center",
        "latitude": 40.7400,
        "longitude": -73.9900
      },
      "customer": {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b6",
        "phone": "+5551234567"
      },
      "status": "SEARCHING_FOR_RIDER",
      "createdAt": "2021-07-21T11:00:00.000Z"
    }
  ]
}
```

### 6. Rate Emergency Call (Patient Only)
**PATCH** `/ride/rate/:rideId`

Allows patients to rate completed emergency calls.

**Request Body:**
```json
{
  "rating": 5
}
```

**Rating scale:** 1-5 (1 = Poor, 5 = Excellent)

**Response:**
```json
{
  "message": "Emergency call rated successfully",
  "ride": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "rating": 5,
    "status": "COMPLETED"
  }
}
```

## 👨‍⚕️ Driver Management System

All driver endpoints are prefixed with `/driver` and require authentication.

### 1. Get Driver Statistics
**GET** `/driver/stats`

Returns comprehensive statistics for authenticated ambulance drivers.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRides": 150,
    "todayRides": 5,
    "todayEarnings": 1250,
    "weeklyRides": 23,
    "weeklyEarnings": 5750,
    "monthlyEarnings": 18500,
    "rating": 4.7
  }
}
```

### 2. Get Driver Profile
**GET** `/driver/profile`

Returns the ambulance driver's profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Dr. John EMT",
    "email": "john.emt@hospital.com",
    "phone": "+1234567890",
    "role": "driver",
    "isOnline": true,
    "vehicle": {
      "type": "advancedAmbulance",
      "plateNumber": "AMB123",
      "model": "Mercedes Sprinter",
      "licenseNumber": "EMT-123456",
      "certificationLevel": "EMT-Paramedic"
    },
    "createdAt": "2021-07-21T10:30:00.000Z"
  }
}
```

### 3. Update Online Status
**PUT** `/driver/online-status`

Updates driver availability for emergency calls.

**Request Body:**
```json
{
  "isOnline": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Driver is now online",
  "data": {
    "isOnline": true
  }
}
```

### 4. Update Ambulance Information
**PUT** `/driver/vehicle`

Updates ambulance and certification details.

**Request Body:**
```json
{
  "type": "icuAmbulance",
  "plateNumber": "AMB456",
  "model": "Ford Transit ICU",
  "licenseNumber": "EMT-789012",
  "certificationLevel": "Critical Care"
}
```

**Valid Certification Levels:**
- `EMT-Basic` - Emergency Medical Technician Basic
- `EMT-Intermediate` - Emergency Medical Technician Intermediate  
- `EMT-Paramedic` - Emergency Medical Technician Paramedic
- `Critical Care` - Critical Care Transport certification

**Response:**
```json
{
  "success": true,
  "message": "Ambulance information updated successfully",
  "data": {
    "vehicle": {
      "type": "icuAmbulance",
      "plateNumber": "AMB456",
      "model": "Ford Transit ICU",
      "licenseNumber": "EMT-789012",
      "certificationLevel": "Critical Care"
    }
  }
}
```

### 5. Get Driver's Emergency Call History
**GET** `/driver/rides`

Returns paginated emergency call history for the driver.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of calls per page (default: 10)

**Example:** `/driver/rides?page=2&limit=5`

**Response:**
```json
{
  "success": true,
  "data": {
    "rides": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "vehicle": "advancedAmbulance",
        "distance": 15.5,
        "fare": 390,
        "pickup": {
          "address": "123 Emergency St",
          "latitude": 40.7128,
          "longitude": -74.0060
        },
        "drop": {
          "address": "City General Hospital",
          "latitude": 40.7589,
          "longitude": -73.9851
        },
        "customer": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "phone": "+0987654321",
          "name": "Jane Patient"
        },
        "status": "COMPLETED",
        "rating": 5,
        "createdAt": "2021-07-21T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 2,
      "totalPages": 15,
      "totalRides": 150,
      "hasNextPage": true,
      "hasPrevPage": true
    }
  }
}
```

## 🔄 Real-time Socket Communication

The system uses Socket.IO for real-time updates. Connect to the socket server using:

```javascript
const socket = io('http://localhost:3000', {
  extraHeaders: {
    access_token: 'your_jwt_token_here'
  }
});
```

### Socket Authentication
All socket connections require JWT authentication via headers:
```javascript
{
  access_token: 'your_jwt_token_here'
}
```

### Patient Socket Events

#### Events to Emit:
- `subscribeToZone(coordinates)` - Subscribe to receive nearby driver updates
- `searchDriver(rideId)` - Search for available ambulance drivers
- `cancelRide()` - Cancel an emergency call
- `subscribeToDriverLocation(driverId)` - Track specific driver's location
- `subscribeRide(rideId)` - Subscribe to emergency call updates

#### Events to Listen:
- `nearbyDrivers` - List of nearby available ambulance drivers
- `rideData` - Emergency call information
- `rideUpdate` - Status updates for emergency calls
- `rideCanceled` - Emergency call cancellation notification
- `driverLocationUpdate` - Real-time driver location updates
- `error` - Error messages

### Driver Socket Events

#### Events to Emit:
- `goOnDuty(coordinates)` - Mark driver as available for emergency calls
- `goOffDuty()` - Mark driver as unavailable
- `updateLocation(coordinates)` - Update driver's current location
- `subscribeRide(rideId)` - Subscribe to emergency call updates

#### Events to Listen:
- `emergencyCall` - New emergency call offer for drivers
- `rideUpdate` - Status updates for emergency calls
- `rideCanceled` - Emergency call cancellation notification
- `rideData` - Emergency call information

### Coordinate Format:
```javascript
{
  latitude: 40.7128,
  longitude: -74.0060
}
```

## 🚨 System Health & Monitoring

### Health Check Endpoint
**GET** `/health`

Returns server health status and database connection state.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2021-07-21T10:30:00.000Z",
  "database": "Connected"
}
```

### Database Status Endpoint
**GET** `/db-status`

Returns detailed database connection information.

**Response:**
```json
{
  "database": {
    "status": "Connected",
    "host": "cluster0.mongodb.net",
    "name": "ambulance_booking"
  },
  "timestamp": "2021-07-21T10:30:00.000Z"
}
```

## ⚠️ Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

### HTTP Status Codes:
- `200` - Success
- `201` - Created (for new resources)
- `400` - Bad Request (validation errors, invalid input)
- `401` - Unauthorized (invalid or missing authentication)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server-side issues)

### Common Error Scenarios:
1. **Authentication Errors**:
   - Missing JWT token
   - Expired token
   - Invalid token format

2. **Validation Errors**:
   - Missing required fields
   - Invalid ambulance type
   - Invalid coordinates
   - Invalid rating (must be 1-5)

3. **Business Logic Errors**:
   - Emergency call not found
   - Call already accepted/completed
   - Cannot rate incomplete calls
   - Driver not available

4. **System Errors**:
   - Database connection issues
   - External service failures

## 📊 Business Logic & System Architecture

### Data Models

#### User Model
```javascript
{
  _id: ObjectId,
  role: String, // "patient" or "driver"
  phone: String, // Unique identifier
  name: String, // Optional
  email: String, // Optional
  isOnline: Boolean, // Driver availability status
  vehicle: {
    type: String, // Ambulance type
    plateNumber: String,
    model: String,
    licenseNumber: String, // EMT license
    certificationLevel: String // EMT certification
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Emergency Call (Ride) Model
```javascript
{
  _id: ObjectId,
  vehicle: String, // Ambulance type required
  distance: Number, // Calculated in kilometers
  fare: Number, // Calculated based on type and distance
  pickup: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  drop: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  customer: ObjectId, // Reference to patient
  rider: ObjectId, // Reference to driver (null initially)
  status: String, // Call status
  otp: String, // 4-digit verification code
  rating: Number, // 1-5 rating (optional)
  createdAt: Date,
  updatedAt: Date
}
```

### Emergency Call Status Flow
```
SEARCHING_FOR_RIDER → START → ARRIVED → COMPLETED
```

1. **SEARCHING_FOR_RIDER**: Initial status, looking for available drivers
2. **START**: Driver accepted and started towards pickup
3. **ARRIVED**: Driver arrived at pickup location  
4. **COMPLETED**: Emergency transport completed

### Fare Calculation Algorithm
```javascript
// Base formula: baseFare + (distance * perKmRate)
// Minimum fare applies if calculated fare is lower

const fareStructure = {
  basicAmbulance: { base: ₹50, perKm: ₹15, minimum: ₹100 },
  advancedAmbulance: { base: ₹80, perKm: ₹20, minimum: ₹150 },
  icuAmbulance: { base: ₹120, perKm: ₹30, minimum: ₹200 },
  airAmbulance: { base: ₹500, perKm: ₹100, minimum: ₹800 }
};
```

### Distance Calculation
Uses Haversine formula for accurate earth-surface distance:
```javascript
const R = 6371; // Earth's radius in kilometers
// Accounts for Earth's curvature for precise distance
```

### Driver Assignment Logic
1. **Search Radius**: 60 kilometers from pickup location
2. **Priority**: Closest available drivers first
3. **Timeout**: 5 minutes maximum search time
4. **Retry Interval**: Every 10 seconds
5. **Auto-cleanup**: Unassigned calls deleted after timeout

### Security Features
- JWT-based authentication with access + refresh tokens
- Role-based access control (patient vs driver endpoints)
- Input validation and sanitization
- OTP verification for emergency calls
- Real-time location encryption in transit

### Performance Optimizations
- MongoDB aggregation pipelines for statistics
- Lean queries for better performance
- Socket connection pooling
- Distance-based driver filtering
- Pagination for large datasets

## 🔧 Development & Deployment

### Environment Variables Required
```env
# Database
MONGO_URI=mongodb://localhost:27017/ambulance_booking

# JWT Secrets
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=3000
NODE_ENV=development
```

### Server Startup Information
When the server starts, you'll see:
```
🚑 Ambulance Service Server running on http://localhost:3000
🌐 Network access: http://192.168.31.49:3000
📍 Health check: http://192.168.31.49:3000/health
🔐 Auth endpoint: http://192.168.31.49:3000/auth/signin
🚨 Emergency calls: http://192.168.31.49:3000/ride/*
👨‍⚕️ Driver endpoints: http://192.168.31.49:3000/driver/*
✅ Database connected successfully
```

### API Testing Examples

#### Using cURL:

**Register/Login as Patient:**
```bash
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "role": "patient"}'
```

**Create Emergency Call:**
```bash
curl -X POST http://localhost:3000/ride/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vehicle": "advancedAmbulance",
    "pickup": {
      "address": "123 Emergency St",
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "drop": {
      "address": "General Hospital",
      "latitude": 40.7589,
      "longitude": -73.9851
    }
  }'
```

**Get Driver Statistics:**
```bash
curl -X GET http://localhost:3000/driver/stats \
  -H "Authorization: Bearer YOUR_DRIVER_TOKEN"
```

### Socket.IO Testing (JavaScript)
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  extraHeaders: {
    access_token: 'your_jwt_token'
  }
});

// For patients
socket.emit('subscribeToZone', {
  latitude: 40.7128,
  longitude: -74.0060
});

socket.on('nearbyDrivers', (drivers) => {
  console.log('Available drivers:', drivers);
});

// For drivers
socket.emit('goOnDuty', {
  latitude: 40.7128,
  longitude: -74.0060
});

socket.on('emergencyCall', (call) => {
  console.log('New emergency call:', call);
});
```

## 🚀 Migration from Ride Booking

### Changes Made:
1. **User Roles**: `customer/rider` → `patient/driver`
2. **Vehicle Types**: `bike/auto/cab` → `ambulance types`
3. **Terminology**: `rides` → `emergency calls`
4. **Pricing**: Updated for medical emergency services
5. **Features**: Added EMT certifications, medical equipment tracking
6. **Socket Events**: `rideOffer` → `emergencyCall`
7. **Business Logic**: Emergency-focused timeouts and priorities

### Backward Compatibility Notes:
- Database field names maintained where possible
- API structure preserved for easier migration
- Socket event names updated for clarity
- Error handling enhanced for medical context

## 📝 Additional Notes

1. **Currency**: All monetary values in Indian Rupees (₹)
2. **Distance**: Calculated and stored in kilometers
3. **Location Accuracy**: System supports high-precision GPS coordinates
4. **Timezone**: All timestamps in ISO format with UTC
5. **Rate Limiting**: Not implemented (recommend adding for production)
6. **CORS**: Currently allows all origins (configure for production)
7. **Database**: MongoDB with automatic connection retry
8. **Logging**: Console-based logging (recommend structured logging for production)
9. **File Upload**: Not implemented (may be needed for medical documents)
10. **Push Notifications**: Not implemented (recommend for mobile apps)

## 🔒 Security Recommendations for Production

1. **Environment Variables**: Use secure secret management
2. **CORS**: Configure specific allowed origins
3. **Rate Limiting**: Implement request rate limiting
4. **Input Validation**: Add comprehensive input sanitization
5. **HTTPS**: Use SSL/TLS certificates
6. **Database**: Enable MongoDB authentication
7. **Monitoring**: Add application performance monitoring
8. **Logging**: Implement structured logging with log rotation
9. **Backup**: Set up automated database backups
10. **Scaling**: Consider load balancing for high availability

---

**System Version**: 2.0 (Ambulance Emergency Services)  
**Last Updated**: January 2024  
**API Compatibility**: RESTful with Socket.IO real-time features  
**Database**: MongoDB with Mongoose ODM

## 📱 Frontend Form Integration

### User Registration & Profile Setup Flow

#### Step 1: Initial Registration
Use `/auth/signin` to register with phone and role only:

```javascript
// Register new user
const registerUser = async (phone, role) => {
  const response = await fetch('/auth/signin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone: phone,
      role: role // "patient" or "driver"
    })
  });
  
  const data = await response.json();
  
  // Store tokens
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  
  return data;
};
```

#### Step 2: Complete Profile Setup
After registration, redirect to profile completion form:

**For Patient Profile Form:**
```html
<form id="patientProfileForm">
  <input type="text" name="name" placeholder="Full Name" required>
  <input type="email" name="email" placeholder="Email Address">
  <button type="submit">Complete Profile</button>
</form>
```

```javascript
// Complete patient profile
const completePatientProfile = async (formData) => {
  const response = await fetch('/auth/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email
    })
  });
  
  return await response.json();
};
```

**For Driver Profile Form:**
```html
<form id="driverProfileForm">
  <!-- Personal Information -->
  <input type="text" name="name" placeholder="Full Name" required>
  <input type="email" name="email" placeholder="Email Address">
  
  <!-- Ambulance Information -->
  <select name="vehicleType" required>
    <option value="">Select Ambulance Type</option>
    <option value="basicAmbulance">Basic Ambulance</option>
    <option value="advancedAmbulance">Advanced Life Support</option>
    <option value="icuAmbulance">ICU Ambulance</option>
    <option value="airAmbulance">Air Ambulance</option>
  </select>
  
  <input type="text" name="plateNumber" placeholder="License Plate Number" required>
  <input type="text" name="model" placeholder="Vehicle Model">
  
  <!-- EMT Certification -->
  <input type="text" name="licenseNumber" placeholder="EMT License Number" required>
  <select name="certificationLevel" required>
    <option value="">Select Certification Level</option>
    <option value="EMT-Basic">EMT-Basic</option>
    <option value="EMT-Intermediate">EMT-Intermediate</option>
    <option value="EMT-Paramedic">EMT-Paramedic</option>
    <option value="Critical Care">Critical Care</option>
  </select>
  
  <button type="submit">Complete Profile</button>
</form>
```

```javascript
// Complete driver profile
const completeDriverProfile = async (formData) => {
  const response = await fetch('/auth/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      vehicle: {
        type: formData.vehicleType,
        plateNumber: formData.plateNumber,
        model: formData.model,
        licenseNumber: formData.licenseNumber,
        certificationLevel: formData.certificationLevel
      }
    })
  });
  
  return await response.json();
};
```

#### Step 3: Load Existing Profile (for editing)
```javascript
// Get current user profile
const getUserProfile = async () => {
  const response = await fetch('/auth/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    }
  });
  
  return await response.json();
};

// Populate form with existing data
const populateForm = async () => {
  const profile = await getUserProfile();
  
  if (profile.user.role === 'driver') {
    document.getElementById('name').value = profile.user.name || '';
    document.getElementById('email').value = profile.user.email || '';
    document.getElementById('vehicleType').value = profile.user.vehicle?.type || '';
    document.getElementById('plateNumber').value = profile.user.vehicle?.plateNumber || '';
    document.getElementById('model').value = profile.user.vehicle?.model || '';
    document.getElementById('licenseNumber').value = profile.user.vehicle?.licenseNumber || '';
    document.getElementById('certificationLevel').value = profile.user.vehicle?.certificationLevel || '';
  }
};
```

### Complete Frontend Integration Example

```javascript
class AmbulanceApp {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.token = localStorage.getItem('access_token');
  }

  // Authentication
  async register(phone, role) {
    const response = await fetch(`${this.baseURL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, role })
    });
    
    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      this.token = data.access_token;
    }
    return data;
  }

  // Profile Management
  async updateProfile(profileData) {
    const response = await fetch(`${this.baseURL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(profileData)
    });
    return await response.json();
  }

  async getProfile() {
    const response = await fetch(`${this.baseURL}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return await response.json();
  }

  // Emergency Calls
  async createEmergencyCall(callData) {
    const response = await fetch(`${this.baseURL}/ride/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(callData)
    });
    return await response.json();
  }

  // Driver specific
  async getDriverStats() {
    const response = await fetch(`${this.baseURL}/driver/stats`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return await response.json();
  }

  async updateOnlineStatus(isOnline) {
    const response = await fetch(`${this.baseURL}/driver/online-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ isOnline })
    });
    return await response.json();
  }
}

// Usage
const app = new AmbulanceApp();

// Register and setup profile
app.register('+1234567890', 'driver')
  .then(() => {
    return app.updateProfile({
      name: 'Dr. John EMT',
      email: 'john@hospital.com',
      vehicle: {
        type: 'advancedAmbulance',
        plateNumber: 'AMB123',
        model: 'Mercedes Sprinter',
        licenseNumber: 'EMT-123456',
        certificationLevel: 'EMT-Paramedic'
      }
    });
  })
  .then(result => {
    console.log('Profile completed:', result);
  });
```

### Form Validation Examples

```javascript
// Validate phone number
const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.length >= 10;
};

// Validate email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate license plate
const validatePlateNumber = (plate) => {
  return plate && plate.length >= 3 && plate.length <= 15;
};

// Form submission with validation
const handleDriverProfileSubmit = async (event) => {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  
  // Validation
  if (!data.name || data.name.trim().length < 2) {
    alert('Please enter a valid name');
    return;
  }
  
  if (data.email && !validateEmail(data.email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  if (!validatePlateNumber(data.plateNumber)) {
    alert('Please enter a valid license plate number');
    return;
  }
  
  // Submit
  try {
    const result = await app.updateProfile({
      name: data.name,
      email: data.email,
      vehicle: {
        type: data.vehicleType,
        plateNumber: data.plateNumber,
        model: data.model,
        licenseNumber: data.licenseNumber,
        certificationLevel: data.certificationLevel
      }
    });
    
    if (result.message === 'Profile updated successfully') {
      alert('Profile updated successfully!');
      // Redirect to dashboard
      window.location.href = '/dashboard';
    }
  } catch (error) {
    alert('Error updating profile: ' + error.message);
  }
};
```
