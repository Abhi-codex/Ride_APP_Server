# Complete Ambulance Booking System API Documentation

This is the comprehensive documentation for the Ambulance Booking System backend API.

## 🚑 System Overview

This system has been converted from a ride-booking platform to a specialized ambulance booking system for emergency medical services. The system supports:

- **Patients**: Users who need emergency medical transport
- **Drivers**: Ambulance drivers with EMT certifications (Independent or Hospital-affiliated)
- **Real-time tracking**: Live location updates and status changes
- **Multiple ambulance types**: BLS, ALS, CCS, Auto, and Bike Safety Units
- **Rating system**: Service quality feedback
- **Hospital Integration**: Support for hospital-affiliated drivers with custom fare formulas

## 🚑 Ambulance Types

The system supports 5 specialized ambulance types, each designed for specific medical emergency scenarios:

### 1. BLS - Basic Life Support
- **Code**: `bls`
- **Description**: Standard ambulance with basic life support equipment
- **Equipment**: Oxygen, defibrillator, basic medications, stretcher
- **Certification Required**: EMT-Basic minimum
- **Use Cases**: Non-critical patient transport, basic medical emergencies

### 2. ALS - Advanced Life Support  
- **Code**: `als`
- **Description**: Advanced ambulance with cardiac monitoring and medications
- **Equipment**: Cardiac monitor, advanced airway management, IV capabilities, medications
- **Certification Required**: EMT-Intermediate or EMT-Paramedic
- **Use Cases**: Cardiac emergencies, respiratory distress, serious trauma

### 3. CCS - Critical Care Support
- **Code**: `ccs` 
- **Description**: ICU-level ambulance for critically ill patients
- **Equipment**: Ventilator, multiple IV pumps, advanced cardiac support, critical care monitoring
- **Certification Required**: Critical Care certification
- **Use Cases**: ICU transfers, post-surgical transport, critical patient inter-facility transfers

### 4. Auto Ambulance (Specially Designed)
- **Code**: `auto`
- **Description**: Compact ambulance designed for urban areas with traffic constraints
- **Equipment**: Basic to intermediate medical equipment in compact design
- **Certification Required**: EMT-Basic to EMT-Intermediate
- **Use Cases**: Urban emergencies, traffic-congested areas, quick response needs

### 5. Bike Safety Unit (Specially Designed)
- **Code**: `bike`
- **Description**: Emergency response motorcycle for rapid first aid and assessment
- **Equipment**: First aid kit, AED, oxygen, basic medications, communication equipment
- **Certification Required**: EMT-Basic minimum + motorcycle license
- **Use Cases**: Traffic jams, crowded areas, initial assessment, rapid response

## 🏥 Driver Types & Fare Calculation

### Independent Drivers
- Use standard platform fare calculation
- Receive standard commission structure
- Manage their own ambulance operations

### Hospital-Affiliated Drivers  
- Connected to specific hospitals
- Use hospital's custom fare formula (if provided)
- Hospital manages fare structure and billing
- Platform facilitates booking and tracking

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

## 🚨 Emergency Service Features

### Emergency Classification
- **Emergency Types**: cardiac, trauma, respiratory, neurological, pediatric, obstetric, psychiatric, burns, poisoning, general
- **Priority Levels**: critical, high, medium, low
- **Special Instructions**: Free-text field for specific medical requirements

### Driver Specializations
Drivers can specify medical specializations that match emergency types:
- **Available Specializations**: cardiac, trauma, respiratory, neurological, pediatric, obstetric, psychiatric, burns, poisoning, general
- **Multiple Specializations**: Drivers can have multiple areas of expertise
- **Validation**: Specializations are validated against the same enum as emergency types

### Smart Emergency Matching
The system now intelligently matches drivers to emergency calls:

#### Compatibility Scoring System
- **Perfect Match (100 points)**: Driver specializes in the exact emergency type
- **Related Specializations (25 points each)**: Cross-specialty matching (e.g., cardiac → respiratory)
- **General Practice (20 points)**: Drivers with "general" specialization get bonus for all calls
- **Priority Bonus**: Additional points based on emergency priority level
  - Critical: +50 points
  - High: +30 points
  - Medium: +15 points
  - Low: +5 points

#### Matching Logic
- **Recommended Calls**: Rides with compatibility score ≥ 50 points
- **Emergency Match**: Perfect specialization match (100+ points)
- **Smart Sorting**: Rides sorted by compatibility score, then by creation time
- **Cross-Specialty Support**: Related specializations provide partial matching

### Enhanced Hospital Search 🏥
The hospital search system now ensures only emergency-capable hospitals are returned:

#### Emergency Capability Validation
- **Multi-Query Search**: Combines searches for "emergency", "trauma center", and "emergency room"
- **Emergency Keywords Filtering**: Identifies hospitals with emergency capabilities
- **Capability Scoring**: Assigns scores based on emergency indicators and features
- **Verification System**: Filters out clinics, urgent care, and non-emergency facilities

#### Capability Scoring Factors
- **Hospital Type (20 points)**: Verified hospital facility
- **Emergency Keywords (25-40 points)**: "Emergency", "Trauma", "Level I/II/III", etc.
- **Specialty Services (15 points)**: Relevant to specific emergency types
- **Patient Rating Bonus (5-10 points)**: High-rated hospitals get priority
- **24/7 Operations (10 points)**: Currently open or 24-hour facilities

#### Search Enhancement Features
- **Emergency-Specific Keywords**: Searches tailored to emergency type (cardiac, trauma, etc.)
- **Exclusion Filters**: Removes dental clinics, veterinary, nursing homes, etc.
- **Smart Sorting**: Emergency verification → Capability score → Service relevance → Distance
- **Minimum Threshold**: Only hospitals with emergency capability score ≥ 30 are returned
- **Comprehensive Results**: Each hospital includes emergency features and verification status

## 🔐 Authentication System

### Authentication Endpoints

#### 1. Firebase Authentication (Primary)
**POST** `/firebase/verify-firebase-token`

Primary authentication method using Firebase Auth with SMS OTP and OAuth support.

**Request Body:**
```json
{
  "token": "firebase_jwt_token",
  "role": "patient|driver|doctor",
  "name": "User Name (optional)",
  "vehicle": {}, // For drivers only
  "hospitalAffiliation": {} // For drivers only
}
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
    "type": "als",
    "plateNumber": "AMB123",
    "model": "Mercedes Sprinter",
    "licenseNumber": "EMT-123456",
    "certificationLevel": "EMT-Paramedic",
    "specializations": ["cardiac", "trauma", "general"]
  },
  "hospitalAffiliation": {
    "isAffiliated": true,
    "hospitalName": "City General Hospital",
    "hospitalId": "CGH001",
    "hospitalAddress": "123 Hospital Street, City",
    "employeeId": "EMP789",
    "customFareFormula": {
      "baseFare": 100,
      "perKmRate": 25,
      "minimumFare": 180
    }
  }
}
```

**Valid Ambulance Types:**
- `bls` - Basic Life Support
- `als` - Advanced Life Support  
- `ccs` - Critical Care Support
- `auto` - Auto Ambulance (specially designed)
- `bike` - Bike Safety Unit (specially designed)

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
      "type": "als",
      "plateNumber": "AMB123",
      "model": "Mercedes Sprinter",
      "licenseNumber": "EMT-123456",
      "certificationLevel": "EMT-Paramedic",
      "specializations": ["cardiac", "trauma", "general"]
    },
    "hospitalAffiliation": {
      "isAffiliated": true,
      "hospitalName": "City General Hospital",
      "hospitalId": "CGH001", 
      "hospitalAddress": "123 Hospital Street, City",
      "employeeId": "EMP789",
      "customFareFormula": {
        "baseFare": 100,
        "perKmRate": 25,
        "minimumFare": 180
      }
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
      "type": "als",
      "plateNumber": "AMB123",
      "model": "Mercedes Sprinter",
      "licenseNumber": "EMT-123456",
      "certificationLevel": "EMT-Paramedic",
      "specializations": ["cardiac", "trauma", "general"]
    },
    "hospitalAffiliation": {
      "isAffiliated": true,
      "hospitalName": "City General Hospital",
      "hospitalId": "CGH001", 
      "hospitalAddress": "123 Hospital Street, City",
      "employeeId": "EMP789",
      "customFareFormula": {
        "baseFare": 100,
        "perKmRate": 25,
        "minimumFare": 180
      }
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
  "vehicle": "als",
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
  "emergency": {
    "type": "cardiac",
    "name": "Heart Attack",
    "priority": "critical"
  }
}
```

**Emergency Type System:**
The frontend now includes a comprehensive emergency classification system that helps patients select appropriate ambulance types and hospitals. The emergency object is optional but recommended for better service matching.

**Emergency Categories:**
- `cardiac` - Heart & Circulation emergencies
- `trauma` - Trauma & Injuries  
- `respiratory` - Breathing Problems
- `neurological` - Brain & Nervous System
- `pediatric` - Child Emergencies
- `obstetric` - Pregnancy & Delivery
- `psychiatric` - Mental Health
- `burns` - Burn Injuries
- `poisoning` - Poisoning & Overdose
- `general` - General Medical

**Emergency Priority Levels:**
- `critical` - Life-threatening emergencies requiring immediate response
- `high` - Serious emergencies needing urgent care
- `medium` - Important medical situations
- `low` - Non-urgent medical transport

**Valid Ambulance Types:**
- `bls` - Basic Life Support (₹50 base + ₹15/km)
- `als` - Advanced Life Support (₹80 base + ₹20/km)
- `ccs` - Critical Care Support (₹120 base + ₹30/km)
- `auto` - Auto Ambulance (₹40 base + ₹12/km) - Specially designed
- `bike` - Bike Safety Unit (₹30 base + ₹10/km) - Specially designed

**Fare Calculation:**
- **Independent Drivers**: Use standard fare formula above
- **Hospital-Affiliated Drivers**: Use custom hospital fare formula if provided

**Response:**
```json
{
  "message": "Emergency call created successfully",
  "ride": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "vehicle": "als",
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
    "emergency": {
      "type": "cardiac",
      "priority": "critical",
      "specialInstructions": "Patient experiencing chest pain"
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

**Important Notes:**
- Driver's ambulance type must match the requested ambulance type
- If driver is hospital-affiliated with a custom fare formula, the fare will be recalculated automatically
- Hospital-affiliated drivers use their hospital's pricing instead of platform pricing

**Response:**
```json
{
  "message": "Emergency call accepted successfully",
  "ride": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "status": "START",
    "fare": 420,
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
      "vehicle": "als",
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

Retrieves emergency calls available for assignment to drivers. Automatically filters by driver's ambulance type and provides intelligent emergency matching based on driver specializations.

**Query Parameters:**
- `vehicle` (optional): Filter by specific ambulance type (bls, als, ccs, auto, bike)
- `emergency` (optional): Filter by emergency type

**Response:**
```json
{
  "message": "Available emergency calls retrieved successfully",
  "count": 3,
  "driverSpecializations": ["cardiac", "general"],
  "emergencyMatching": true,
  "rides": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "vehicle": "als",
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
      "emergency": {
        "type": "cardiac",
        "priority": "critical",
        "specialInstructions": "Patient experiencing chest pain"
      },
      "customer": {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b6",
        "phone": "+5551234567"
      },
      "status": "SEARCHING_FOR_RIDER",
      "compatibilityScore": 150,
      "isRecommended": true,
      "emergencyMatch": true,
      "createdAt": "2021-07-21T11:00:00.000Z"
    },
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "vehicle": "als",
      "distance": 12.5,
      "fare": 520,
      "pickup": {
        "address": "789 Main Street",
        "latitude": 40.7200,
        "longitude": -74.0200
      },
      "drop": {
        "address": "City General Hospital",
        "latitude": 40.7500,
        "longitude": -73.9800
      },
      "emergency": {
        "type": "trauma",
        "priority": "high",
        "specialInstructions": "Motor vehicle accident"
      },
      "customer": {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b7",
        "phone": "+5559876543"
      },
      "status": "SEARCHING_FOR_RIDER",
      "compatibilityScore": 50,
      "isRecommended": true,
      "emergencyMatch": false,
      "createdAt": "2021-07-21T11:05:00.000Z"
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
      "type": "als",
      "plateNumber": "AMB123",
      "model": "Mercedes Sprinter",
      "licenseNumber": "EMT-123456",
      "certificationLevel": "EMT-Paramedic",
      "specializations": ["cardiac", "trauma", "general"]
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
  "type": "ccs",
  "plateNumber": "AMB456",
  "model": "Ford Transit CCS",
  "licenseNumber": "EMT-789012",
  "certificationLevel": "Critical Care",
  "specializations": ["cardiac", "trauma", "general"]
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
      "type": "ccs",
      "plateNumber": "AMB456",
      "model": "Ford Transit CCS",
      "licenseNumber": "EMT-789012",
      "certificationLevel": "Critical Care",
      "specializations": ["cardiac", "trauma", "general"]
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
        "vehicle": "als",
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
        "emergency": {
          "type": "cardiac",
          "priority": "critical",
          "specialInstructions": "Patient experiencing chest pain"
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
    certificationLevel: String, // EMT certification
    specializations: [String] // Array of emergency specializations (e.g., ["cardiac", "trauma", "pediatric"])
  },
  hospitalAffiliation: { // Hospital affiliation for drivers
    isAffiliated: Boolean,
    hospitalName: String,
    hospitalId: String,
    hospitalAddress: String,
    employeeId: String,
    customFareFormula: {
      baseFare: Number,
      perKmRate: Number,
      minimumFare: Number
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Hospital Model (NEW)
```javascript
{
  _id: ObjectId,
  name: String,
  location: {
    latitude: Number,
    longitude: Number
  },
  address: String,
  phoneNumber: String,
  emergencyServices: [String], // Array of emergency capabilities
  placeId: String, // Google Places ID
  rating: Number,
  isVerified: Boolean,
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
  emergency: { // Emergency context information
    type: String, // Emergency type (e.g., "cardiac", "trauma", "respiratory")
    priority: String, // "low", "medium", "high", "critical"
    specialInstructions: String // Optional special medical instructions
  },
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
  bls: { base: ₹50, perKm: ₹15, minimum: ₹100 },
  als: { base: ₹80, perKm: ₹20, minimum: ₹150 },
  ccs: { base: ₹120, perKm: ₹30, minimum: ₹200 },
  auto: { base: ₹40, perKm: ₹12, minimum: ₹80 },
  bike: { base: ₹30, perKm: ₹10, minimum: ₹60 }
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

# Google Places API (for hospital search)
GOOGLE_PLACES_API_KEY=your_google_places_api_key

# Server
PORT=3000
NODE_ENV=development
```

### Server Startup Information
When the server starts, you'll see:
```
🚑 Service Server running on http://localhost:3000
🌐 Network access: http://192.168.31.49:3000
📍 Health check: http://192.168.31.49:3000/health
🔐 Auth endpoint: http://192.168.31.49:3000/auth/signin
🏥 Hospital search: http://192.168.31.49:3000/hospitals/*
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
    "vehicle": "als",
    "pickup": {
      "address": "123 Emergency St",
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "drop": {
      "address": "General Hospital",
      "latitude": 40.7589,
      "longitude": -73.9851
    },
    "emergency": {
      "type": "cardiac",
      "priority": "critical",
      "specialInstructions": "Patient experiencing chest pain"
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

**System Version**: 3.0 (Emergency Ambulance Services with Smart Matching & Hospital Integration)  
**Last Updated**: July 2025  
**API Compatibility**: RESTful with Socket.IO real-time features  
**Database**: MongoDB with Mongoose ODM
**External APIs**: Google Places API for hospital discovery

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
    <option value="bls">Basic Life Support (BLS)</option>
    <option value="als">Advanced Life Support (ALS)</option>
    <option value="ccs">Critical Care Support (CCS)</option>
    <option value="auto">Auto Ambulance</option>
    <option value="bike">Bike Safety Unit</option>
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
        type: 'als',
        plateNumber: 'AMB123',
        model: 'Mercedes Sprinter',
        licenseNumber: 'EMT-123456',
        certificationLevel: 'EMT-Paramedic',
        specializations: ['cardiac', 'trauma', 'general']
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

## 🏥 Hospital Management System

All hospital endpoints are prefixed with `/hospitals` and provide comprehensive hospital discovery and management.

### 1. Search Hospitals (Google Places API)
**GET** `/hospitals/search`

Search for hospitals near a location using Google Places API with emergency-specific filtering.

**Query Parameters:**
- `lat` (required): Latitude coordinate
- `lng` (required): Longitude coordinate  
- `emergency` (optional): Emergency type for service filtering
- `radius` (optional): Search radius in meters (default: 10000)

**Example:** `/hospitals/search?lat=40.7128&lng=-74.0060&emergency=cardiac&radius=15000`

**Emergency Types for Filtering:**
- `cardiac` - Heart & cardiovascular emergencies
- `trauma` - Trauma & injuries (prioritizes trauma centers)
- `respiratory` - Breathing problems
- `neurological` - Brain and nervous system (prioritizes neurology)
- `pediatrics` - Specialized child emergency care
- `obstetrics` - Pregnancy and delivery services
- `burns` - Burn injuries (prioritizes burn units)
- `psychiatry` - Mental health emergencies
- `intensive_care` - Critical care capabilities
- `surgery` - Surgical emergency capabilities
- `blood_bank` - Blood transfusion services

**Response:**
```json
{
  "message": "Emergency-capable hospitals retrieved successfully",
  "count": 3,
  "totalFound": 5,
  "hospitals": [
    {
      "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "City General Hospital - Emergency Center",
      "latitude": 40.7589,
      "longitude": -73.9851,
      "rating": 4.2,
      "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "address": "123 Hospital Ave, New York, NY",
      "emergencyServices": ["emergency_room", "cardiology", "intensive_care", "trauma_center"],
      "distance": 2.5,
      "isOpen": true,
      "priceLevel": null,
      "photos": [
        {
          "photoReference": "ATplDJa7_cHlQ1pXXGxKnKG8FN2zn...",
          "width": 4032,
          "height": 3024
        }
      ],
      "emergencyCapabilityScore": 85,
      "emergencyFeatures": [
        "Emergency facility",
        "Trauma center", 
        "High patient rating (4.0+)",
        "cardiac specialization"
      ],
      "isEmergencyVerified": true
    }
  ],
  "emergency": "cardiac",
  "searchRadius": 15000,
  "searchCriteria": {
    "minimumEmergencyScore": 30,
    "emergencyVerifiedOnly": false,
    "emergencyType": "cardiac"
  }
}
```

### 2. Get Hospital Details
**GET** `/hospitals/details/:placeId`

Get detailed information about a specific hospital using Google Places API.

**Parameters:**
- `placeId`: Google Places ID of the hospital

**Response:**
```json
{
  "message": "Hospital details retrieved successfully",
  "hospital": {
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "name": "City General Hospital",
    "address": "123 Hospital Ave, New York, NY 10001",
    "latitude": 40.7589,
    "longitude": -73.9851,
    "rating": 4.2,
    "phoneNumber": "+1 (212) 555-0123",
    "website": "https://citygeneralhospital.com",
    "openingHours": [
      "Monday: Open 24 hours",
      "Tuesday: Open 24 hours",
      "Wednesday: Open 24 hours",
      "Thursday: Open 24 hours",
      "Friday: Open 24 hours",
      "Saturday: Open 24 hours",
      "Sunday: Open 24 hours"
    ],
    "isOpen": true,
    "photos": [
      {
        "photoReference": "ATplDJa7_cHlQ1pXXGxKnKG8FN2zn...",
        "width": 4032,
        "height": 3024,
        "attributions": ["Google User"]
      },
      {
        "photoReference": "ATplDJY9rKxNV2nQ8pEbF1G7mN...",
        "width": 3024,
        "height": 4032,
        "attributions": ["Hospital Official"]
      }
    ],
    "emergencyCapabilityScore": 75,
    "emergencyFeatures": [
      "Emergency facility",
      "Medical center",
      "High patient rating (4.0+)",
      "Currently open/24-7 operations"
    ],
    "isEmergencyVerified": true,
    "emergencyServices": ["emergency_room", "cardiology", "intensive_care"],
    "recommendation": "Verified emergency-capable hospital"
  }
}
```

### 3. Get Hospital Photo
**GET** `/hospitals/photo/:photoReference`

Retrieve actual hospital photo images using Google Places API photo references.

**Parameters:**
- `photoReference`: Photo reference string obtained from hospital details or search results

**Query Parameters:**
- `maxwidth` (optional): Maximum width of photo (default: 400, max: 1600)
- `maxheight` (optional): Maximum height of photo (default: 400, max: 1600)

**Example:** `/hospitals/photo/ATplDJa7_cHlQ1pXXGxKnKG8FN2zn?maxwidth=600&maxheight=400`

**Response:**
- Content-Type: `image/jpeg` (or appropriate image format)
- Cache-Control: `public, max-age=86400` (24-hour cache)
- Returns binary image data

**Frontend Usage Examples:**

**React.js Example:**
```jsx
import React, { useState, useEffect } from 'react';

const HospitalImage = ({ photoReference, maxwidth = 400, maxheight = 300 }) => {
  const [imageUrl, setImageUrl] = useState('/placeholder.jpg');

  useEffect(() => {
    if (photoReference) {
      const url = `${process.env.REACT_APP_API_URL}/hospitals/photo/${photoReference}?maxwidth=${maxwidth}&maxheight=${maxheight}`;
      setImageUrl(url);
    }
  }, [photoReference, maxwidth, maxheight]);

  return (
    <img 
      src={imageUrl} 
      alt="Hospital"
      style={{ width: '100%', height: '200px', objectFit: 'cover' }}
      onError={(e) => {
        e.target.src = '/placeholder.jpg'; // Fallback image
      }}
    />
  );
};
```

**HTML/JavaScript Example:**
```html
<div class="hospital-card">
  <img id="hospital-image" src="/placeholder.jpg" alt="Hospital" />
  <h3 id="hospital-name"></h3>
</div>

<script>
function displayHospitalPhoto(hospital) {
  const img = document.getElementById('hospital-image');
  const name = document.getElementById('hospital-name');
  
  if (hospital.photos && hospital.photos.length > 0) {
    const photoReference = hospital.photos[0].photoReference;
    img.src = `http://localhost:3000/hospitals/photo/${photoReference}?maxwidth=400&maxheight=300`;
  }
  
  name.textContent = hospital.name;
  
  // Handle image load errors
  img.onerror = function() {
    this.src = '/placeholder.jpg';
  };
}
</script>
```

**Photo Features:**
- **Automatic Caching**: Photos are cached for 24 hours to improve performance
- **Multiple Photos**: Hospital details include up to 5 photos, search results include 1
- **Size Control**: Customizable dimensions via query parameters
- **Error Handling**: Graceful fallback when photos aren't available
- **CORS Support**: Can be accessed from frontend applications
- **Attribution**: Photo attributions included in hospital details response

### 4. Get Local Hospitals Database
**GET** `/hospitals`

Retrieve hospitals from the local database with optional filtering.

**Query Parameters:**
- `lat` (optional): Latitude for distance calculation
- `lng` (optional): Longitude for distance calculation
- `radius` (optional): Search radius in meters (default: 50000)
- `emergency` (optional): Filter by emergency service capability

**Response:**
```json
{
  "message": "Hospitals retrieved successfully",
  "count": 3,
  "hospitals": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Metro Medical Center",
      "location": {
        "latitude": 40.7300,
        "longitude": -74.0100
      },
      "emergencyServices": ["emergency_room", "trauma_center", "surgery"],
      "rating": 4.5,
      "phoneNumber": "+1 (212) 555-0456",
      "address": "456 Medical Plaza, New York, NY",
      "isVerified": true,
      "distance": 3.2
    }
  ]
}
```

### 5. Create Hospital (Authenticated)
**POST** `/hospitals`

Add a new hospital to the local database. (Requires authentication)

**Request Body:**
```json
{
  "name": "New Medical Center",
  "latitude": 40.7400,
  "longitude": -73.9900,
  "address": "789 Health Street, New York, NY",
  "emergencyServices": ["emergency_room", "cardiology", "neurology"],
  "placeId": "ChIJAbCdEfGhIjKlMnOpQrSt",
  "rating": 4.0,
  "phoneNumber": "+1 (212) 555-0789"
}
```

**Response:**
```json
{
  "message": "Hospital created successfully",
  "hospital": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
    "name": "New Medical Center",
    "location": {
      "latitude": 40.7400,
      "longitude": -73.9900
    },
    "emergencyServices": ["emergency_room", "cardiology", "neurology"],
    "placeId": "ChIJAbCdEfGhIjKlMnOpQrSt",
    "rating": 4.0,
    "phoneNumber": "+1 (212) 555-0789",
    "address": "789 Health Street, New York, NY",
    "isVerified": false,
    "createdAt": "2021-07-21T10:30:00.000Z"
  }
}
```

### Hospital Emergency Services

The system recognizes these emergency service capabilities:

- **`emergency_room`** - General emergency services (all hospitals)
- **`cardiology`** - Heart & cardiovascular emergencies
- **`trauma_center`** - Major trauma and accident treatment
- **`neurology`** - Brain and nervous system treatment
- **`pediatrics`** - Specialized child emergency care
- **`obstetrics`** - Pregnancy and delivery services
- **`burn_unit`** - Specialized burn injury treatment
- **`psychiatry`** - Mental health emergency services
- **`intensive_care`** - Critical care capabilities
- **`surgery`** - Surgical emergency capabilities
- **`blood_bank`** - Blood transfusion services

### Google Places API Integration

**Required Environment Variables:**
```env
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

**Setup Steps:**
1. Create Google Cloud Console project
2. Enable Places API, Maps JavaScript API, Geocoding API
3. Create API key and restrict to your application
4. Add API key to environment variables

**API Quotas & Limits:**
- Hospital search: Uses Places Nearby Search API
- Hospital details: Uses Places Details API
- Recommended: Set daily quotas to prevent overuse
- Consider caching results to reduce API calls
