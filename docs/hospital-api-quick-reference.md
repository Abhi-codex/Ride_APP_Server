# 🏥 Hospital Dashboard API - Quick Reference

## 🔗 Endpoint Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/staff/login` | Hospital staff authentication | ❌ |
| `GET` | `/incoming-patients` | Get incoming patients list | ✅ |
| `GET` | `/live-tracking` | Live ambulance tracking | ✅ |
| `GET` | `/ambulance-status` | Ambulance status overview | ✅ |
| `GET` | `/emergency-contacts` | Emergency contact information | ✅ |
| `GET` | `/bed-availability` | Current bed availability | ✅ |
| `PUT` | `/bed-availability` | Update bed availability | ✅ |
| `PUT` | `/ambulance-location` | Update ambulance location | ✅ |

## 🔐 Authentication

**Login Request:**
```bash
curl -X POST http://localhost:3000/hospital-dashboard/staff/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@citygeneralhospital.com","password":"password123"}'
```

**Using Token:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/hospital-dashboard/incoming-patients
```

## 📊 Key Response Fields

### Incoming Patients
- `count`: Number of incoming patients
- `patients[].condition.priority`: `critical`, `high`, `medium`, `low`
- `patients[].timeToArrival`: ETA in minutes
- `patients[].ambulance.status`: `occupied`, `free`, `offline`

### Live Tracking
- `totalAmbulances`: Total tracked ambulances
- `ambulances[].isComingToThisHospital`: Boolean
- `ambulances[].currentLocation`: GPS coordinates + address
- `ambulances[].lastUpdated`: Timestamp

### Ambulance Status
- `summary.total/online/free/occupied/offline`: Counts
- `ambulances[].status`: Current status
- `ambulances[].currentRide`: Active patient info (if any)

### Bed Availability
- `hospital.totalBeds/availableBeds`: Overall counts
- `hospital.bedDetails.icu/general/emergency`: Per-type availability

## 🔄 Update Operations

### Update Beds:
```json
{
  "bedDetails": {
    "icu": {"available": 5, "total": 20},
    "general": {"available": 30, "total": 100},
    "emergency": {"available": 8, "total": 30}
  },
  "totalBeds": 150,
  "availableBeds": 43
}
```

### Update Ambulance Location:
```json
{
  "ambulanceId": "AMB-001",
  "currentLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "Near Central Park"
  },
  "timestamp": "2025-08-22T14:35:00Z"
}
```

## ⚠️ Common Error Responses

**401 Unauthorized:**
```json
{"error": "Access denied. No token provided"}
```

**400 Bad Request:**
```json
{"error": "Please provide email and password"}
```

**404 Not Found:**
```json
{"error": "Hospital not found"}
```

## 🔧 Frontend Integration Tips

1. **Store JWT Token:**
   ```js
   localStorage.setItem('hospitalToken', data.token);
   ```

2. **Auto-refresh Data:**
   ```js
   setInterval(loadDashboardData, 30000); // 30 seconds
   ```

3. **Handle Errors:**
   ```js
   if (!response.ok) {
     const error = await response.json();
     alert(error.error || 'Something went wrong');
   }
   ```

4. **Call Emergency Numbers:**
   ```html
   <a href="tel:+1234567890">📞 Call Driver</a>
   ```

## 🚀 Testing Commands

**PowerShell (Windows):**
```powershell
# Login
$loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/hospital-dashboard/staff/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"admin@citygeneralhospital.com","password":"password123"}'

# Get token from response and use for other calls
$token = (ConvertFrom-Json $loginResponse.Content).token
$headers = @{"Authorization"="Bearer $token"}

# Test endpoints
Invoke-WebRequest -Uri "http://localhost:3000/hospital-dashboard/incoming-patients" -Headers $headers
```

**curl (Linux/Mac):**
```bash
# Login and extract token
TOKEN=$(curl -s -X POST http://localhost:3000/hospital-dashboard/staff/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@citygeneralhospital.com","password":"password123"}' \
  | jq -r '.token')

# Use token for API calls
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/hospital-dashboard/incoming-patients
```

## 📱 Demo Credentials

- **Email:** `admin@citygeneralhospital.com`
- **Password:** `password123`
- **Hospital:** City General Hospital
- **Role:** Admin with full permissions

## 🎯 Priority Levels

| Priority | Description | Color Code |
|----------|-------------|------------|
| `critical` | Life-threatening | 🔴 Red |
| `high` | Urgent care needed | 🟠 Orange |
| `medium` | Stable but needs attention | 🟡 Yellow |
| `low` | Non-urgent | 🟢 Green |

## 🏥 Ambulance Types

- **ALS** (Advanced Life Support): Full medical equipment
- **BLS** (Basic Life Support): Standard transport
- **CCT** (Critical Care Transport): ICU-level care

## 📍 Location Format

All location data uses this format:
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "address": "Human-readable address (optional)"
}
```
