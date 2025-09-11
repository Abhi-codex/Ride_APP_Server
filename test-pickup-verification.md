# Pickup Verification API Test Guide

## New Endpoint Added
✅ **POST `/ride/verify-pickup`** - Verify pickup completion with OTP

## Test the Implementation

### Prerequisites
1. Start the server: `npm start` or `node app.js`
2. Have a driver authenticated with valid JWT token
3. Have a ride in "START" status with a valid OTP

### Test Request Example

```bash
curl -X POST http://localhost:3000/ride/verify-pickup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DRIVER_JWT_TOKEN" \
  -d '{
    "rideId": "RIDE_ID_HERE",
    "otp": "1234",
    "driverLocation": {
      "latitude": 12.9716,
      "longitude": 77.5946
    }
  }'
```

### Expected Response Scenarios

#### ✅ Success (200)
```json
{
  "success": true,
  "message": "Pickup verified successfully",
  "ride": {
    "_id": "ride_id",
    "status": "ARRIVED",
    "customer": {...},
    "rider": {...},
    "pickup": {...},
    "drop": {...},
    "emergency": {...},
    "liveTracking": {
      "driverLocation": {
        "latitude": 12.9716,
        "longitude": 77.5946
      },
      "lastUpdated": "2025-09-11T..."
    },
    "destinationHospital": {...}
  }
}
```

#### ❌ Invalid OTP (400)
```json
{
  "success": false,
  "error": "Invalid OTP",
  "message": "The provided OTP is incorrect"
}
```

#### ❌ Location Too Far (400)
```json
{
  "success": false,
  "error": "Location verification failed",
  "message": "Driver is not at the pickup location",
  "details": {
    "distanceToPickup": 250,
    "requiredDistance": 100
  }
}
```

#### ❌ Rate Limited (429)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many OTP verification attempts. Please try again later."
}
```

#### ❌ OTP Expired (400)
```json
{
  "success": false,
  "error": "OTP expired",
  "message": "The OTP has expired. Please contact the patient for a new OTP."
}
```

## Security Features Implemented

✅ **OTP Validation** - Verifies 4-digit OTP matches ride OTP
✅ **Location Verification** - Ensures driver is within 100m of pickup location  
✅ **Rate Limiting** - Max 5 attempts per 10 minutes per ride
✅ **OTP Expiry** - OTP expires after 10 minutes
✅ **Authorization** - Only assigned driver can verify pickup
✅ **Audit Logging** - All verification attempts are logged
✅ **Real-time Updates** - Socket events notify all parties

## Integration Notes

- The endpoint integrates with existing ride status flow
- Updates `liveTracking.driverLocation` with verified location
- Transitions ride status from "START" to "ARRIVED"  
- Emits socket events for real-time UI updates
- Clears OTP verification attempts on success
- Compatible with existing error handling middleware

## Updated Endpoints List

### Ride Endpoints (`/ride`)
- `POST /ride/create` - Create a new ride/emergency call
- `PATCH /ride/accept/:rideId` - Accept a ride (driver only)
- `PATCH /ride/update/:rideId` - Update ride status  
- `GET /ride/rides` - Get user's rides
- `GET /ride/driverrides` - Get available rides for drivers
- `PATCH /ride/rate/:rideId` - Rate a completed ride
- **🆕 `POST /ride/verify-pickup`** - Verify pickup completion with OTP (driver only)
