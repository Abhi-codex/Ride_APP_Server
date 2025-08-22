# 🏥 InstaAid Hospital Dashboard API Documentation

## Overview
The Hospital Dashboard API provides comprehensive endpoints for hospital staff to manage incoming patients, track ambulances, monitor bed availability, and access emergency contacts. This system is designed for 3 collaborating hospitals to coordinate ambulance services and emergency responses.

## Base URL
```
http://localhost:3000/hospital-dashboard
```

## Authentication
All endpoints (except login) require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

## 📋 API Endpoints

### 1. 🔐 Hospital Staff Login

**Endpoint:** `POST /staff/login`

**Description:** Authenticate hospital staff and receive access token

**Request Body:**
```json
{
  "email": "admin@citygeneralhospital.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "staff": {
    "id": "64f8b1c2e4b0a1234567890a",
    "name": "Dr. Sarah Johnson",
    "email": "admin@citygeneralhospital.com",
    "role": "admin",
    "department": "Emergency",
    "permissions": ["view_patients", "manage_beds", "view_ambulances"],
    "hospital": {
      "_id": "64f8b1c2e4b0a1234567890b",
      "name": "City General Hospital",
      "address": "123 Medical Center Drive, Downtown",
      "location": {
        "type": "Point",
        "coordinates": [-74.006, 40.7128]
      }
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Error):**
```json
{
  "error": "Invalid credentials"
}
```

---

### 2. 🚑 Incoming Patients

**Endpoint:** `GET /incoming-patients`

**Description:** Get list of patients currently en route to the hospital

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "count": 2,
  "patients": [
    {
      "rideId": "64f8b1c2e4b0a1234567890c",
      "ambulanceId": "AMB-001",
      "patient": {
        "name": "John Smith",
        "age": 45,
        "phone": "+1234567890"
      },
      "condition": {
        "type": "cardiac",
        "description": "Heart attack symptoms",
        "priority": "critical",
        "specialInstructions": "Patient has pacemaker"
      },
      "contactInfo": {
        "patientRelative": {
          "name": "Jane Smith",
          "relationship": "spouse",
          "phone": "+1234567891"
        }
      },
      "ambulance": {
        "type": "als",
        "status": "occupied",
        "driver": {
          "name": "Mike Wilson",
          "phone": "+1234567892"
        }
      },
      "estimatedDistance": 5.2,
      "timeToArrival": 12,
      "pickupLocation": "456 Oak Street",
      "emergencyCall": {
        "time": "2025-08-22T14:30:00Z",
        "caller": "Jane Smith"
      }
    }
  ]
}
```

---

### 3. 🗺️ Live Ambulance Tracking

**Endpoint:** `GET /live-tracking`

**Description:** Get real-time locations and status of all ambulances

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "totalAmbulances": 5,
  "ambulances": [
    {
      "ambulanceId": "AMB-001",
      "type": "als",
      "status": "occupied",
      "isComingToThisHospital": true,
      "currentLocation": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "Near Central Park"
      },
      "driver": {
        "name": "Mike Wilson",
        "phone": "+1234567892"
      },
      "patient": {
        "name": "John Smith",
        "condition": "cardiac emergency",
        "priority": "critical"
      },
      "lastUpdated": "2025-08-22T14:35:00Z"
    },
    {
      "ambulanceId": "AMB-002",
      "type": "bls",
      "status": "free",
      "isComingToThisHospital": false,
      "currentLocation": {
        "latitude": 40.7589,
        "longitude": -73.9851,
        "address": "Times Square Area"
      },
      "driver": {
        "name": "Sarah Davis",
        "phone": "+1234567893"
      },
      "patient": null,
      "lastUpdated": "2025-08-22T14:33:00Z"
    }
  ]
}
```

---

### 4. 📊 Ambulance Status

**Endpoint:** `GET /ambulance-status`

**Description:** Get detailed status overview of all affiliated ambulances

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "summary": {
    "total": 5,
    "online": 4,
    "free": 2,
    "occupied": 2,
    "offline": 1
  },
  "ambulances": [
    {
      "ambulanceId": "AMB-001",
      "status": "occupied",
      "driver": {
        "name": "Mike Wilson",
        "phone": "+1234567892",
        "isOnline": true
      },
      "vehicle": {
        "type": "als",
        "plateNumber": "EMG-001",
        "lastMaintenance": "2025-08-15T00:00:00Z"
      },
      "currentRide": {
        "patient": "John Smith",
        "priority": "critical",
        "destination": "City General Hospital"
      }
    },
    {
      "ambulanceId": "AMB-002",
      "status": "free",
      "driver": {
        "name": "Sarah Davis",
        "phone": "+1234567893",
        "isOnline": true
      },
      "vehicle": {
        "type": "bls",
        "plateNumber": "EMG-002",
        "lastMaintenance": "2025-08-10T00:00:00Z"
      },
      "currentRide": null
    }
  ]
}
```

---

### 5. 📞 Emergency Contacts

**Endpoint:** `GET /emergency-contacts`

**Description:** Get emergency contact information for active rides

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "contacts": [
    {
      "ambulanceId": "AMB-001",
      "emergency": "cardiac",
      "priority": "critical",
      "patient": {
        "name": "John Smith",
        "phone": "+1234567890"
      },
      "relative": {
        "name": "Jane Smith",
        "relationship": "spouse",
        "phone": "+1234567891"
      },
      "driver": {
        "name": "Mike Wilson",
        "phone": "+1234567892"
      }
    }
  ]
}
```

---

### 6. 🛏️ Get Bed Availability

**Endpoint:** `GET /bed-availability`

**Description:** Get current bed availability status

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "hospital": {
    "name": "City General Hospital",
    "totalBeds": 150,
    "availableBeds": 42,
    "bedDetails": {
      "icu": {
        "available": 5,
        "total": 20
      },
      "general": {
        "available": 30,
        "total": 100
      },
      "emergency": {
        "available": 7,
        "total": 30
      }
    },
    "lastUpdated": "2025-08-22T14:30:00Z"
  }
}
```

---

### 7. 🛏️ Update Bed Availability

**Endpoint:** `PUT /bed-availability`

**Description:** Update hospital bed availability

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "bedDetails": {
    "icu": {
      "available": 4,
      "total": 20
    },
    "general": {
      "available": 25,
      "total": 100
    },
    "emergency": {
      "available": 6,
      "total": 30
    }
  },
  "totalBeds": 150,
  "availableBeds": 35
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Bed availability updated successfully",
  "hospital": {
    "name": "City General Hospital",
    "totalBeds": 150,
    "availableBeds": 35,
    "bedDetails": {
      "icu": {
        "available": 4,
        "total": 20
      },
      "general": {
        "available": 25,
        "total": 100
      },
      "emergency": {
        "available": 6,
        "total": 30
      }
    },
    "lastUpdated": "2025-08-22T14:35:00Z"
  }
}
```

---

### 8. 📍 Update Ambulance Location

**Endpoint:** `PUT /ambulance-location`

**Description:** Update live tracking information for ambulances

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "ambulanceId": "AMB-001",
  "currentLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "Near Central Park"
  },
  "driverLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "timestamp": "2025-08-22T14:35:00Z"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Ambulance location updated successfully",
  "ambulance": {
    "ambulanceId": "AMB-001",
    "currentLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "Near Central Park"
    },
    "lastUpdated": "2025-08-22T14:35:00Z"
  }
}
```

---

## 🔐 Authentication Middleware

The hospital dashboard uses a dedicated authentication middleware (`hospitalAuth.js`) that:

1. Verifies JWT tokens in the `Authorization` header
2. Checks if the staff member is active
3. Populates `req.hospitalStaff` with authenticated staff information
4. Allows access only to hospital staff with valid permissions

---

## 📱 Frontend Integration

### Login Example (JavaScript):
```javascript
const response = await fetch('http://localhost:3000/hospital-dashboard/staff/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@citygeneralhospital.com',
    password: 'password123'
  })
});

const data = await response.json();
if (response.ok) {
  localStorage.setItem('hospitalToken', data.token);
  // Redirect to dashboard
}
```

### API Call Example (JavaScript):
```javascript
const response = await fetch('http://localhost:3000/hospital-dashboard/incoming-patients', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('hospitalToken')}`
  }
});

const data = await response.json();
// Process incoming patients data
```

---

## ⚡ Real-time Features

### Auto-refresh Implementation:
```javascript
// Refresh data every 30 seconds
setInterval(async () => {
  await loadIncomingPatients();
  await loadAmbulanceTracking();
  await loadAmbulanceStatus();
}, 30000);
```

### Error Handling:
```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Show user-friendly error message
}
```
