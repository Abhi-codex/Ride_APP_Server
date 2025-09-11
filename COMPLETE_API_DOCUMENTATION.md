# Complete API Endpoints Documentation

## Authentication Endpoints (`/auth`)
- `POST /auth/send-otp` - Send OTP to phone number for login
- `POST /auth/verify-otp` - Verify OTP and complete login
- `POST /auth/refresh-token` - Refresh expired access token
- `PUT /auth/profile` - Update user profile information
- `GET /auth/profile` - Get current user profile

## Ride Management Endpoints (`/ride`)
- `POST /ride/create` - Create a new emergency ride/ambulance call
- `PATCH /ride/accept/:rideId` - Accept and assign ride to driver (driver only)
- `PATCH /ride/update/:rideId` - Update ride status (START, ARRIVED, COMPLETED)
- `GET /ride/rides` - Get user's ride history (customer or driver)
- `GET /ride/driverrides` - Get available rides for drivers to accept
- `PATCH /ride/rate/:rideId` - Rate completed ride experience
- **🆕 `POST /ride/verify-pickup`** - Verify pickup completion with OTP and location (driver only)

## Driver Management Endpoints (`/driver`)
- `GET /driver/profile` - Get driver profile and vehicle information
- `PUT /driver/profile` - Update driver profile details
- `GET /driver/stats` - Get driver performance statistics
- `PUT /driver/online-status` - Toggle driver online/offline status
- `PUT /driver/vehicle` - Update ambulance/vehicle information
- `GET /driver/rides` - Get driver's completed ride history

## Hospital Discovery Endpoints (`/hospitals`)
- `GET /hospitals/search` - Search nearby hospitals by location and filters
- `GET /hospitals/details/:placeId` - Get detailed hospital information
- `GET /hospitals/photo/:photoReference` - Get hospital photos
- `POST /hospitals` - Register new hospital in system
- `GET /hospitals` - Get all registered hospitals

## Hospital Dashboard Endpoints (`/hospital-dashboard`)
### Authentication
- `POST /hospital-dashboard/staff/login` - Hospital staff login
- `POST /hospital-dashboard/staff/create` - Create new staff account

### Dashboard Data
- `GET /hospital-dashboard/dashboard` - Get comprehensive dashboard overview
- `GET /hospital-dashboard/rides` - Get all rides directed to hospital
- `GET /hospital-dashboard/drivers` - Get affiliated drivers list
- `GET /hospital-dashboard/analytics` - Get hospital analytics and metrics

### Real-time Tracking
- `GET /hospital-dashboard/incoming-patients` - Get incoming patient details
- `GET /hospital-dashboard/live-tracking` - Get live ambulance tracking data
- `GET /hospital-dashboard/ambulance-status` - Get ambulance status overview
- `GET /hospital-dashboard/emergency-contacts` - Get emergency contact information

### Hospital Management
- `PATCH /hospital-dashboard/info` - Update hospital information
- `GET /hospital-dashboard/bed-availability` - Get current bed availability
- `PUT /hospital-dashboard/bed-availability` - Update bed availability counts
- `PUT /hospital-dashboard/ambulance/:rideId/location` - Update ambulance location

## Doctor Management Endpoints (`/doctor`)
### Public Access
- `GET /doctor/:doctorId/availability` - Get doctor availability (public access)

### Doctor Portal
- `GET /doctor/profile` - Get doctor profile information
- `PUT /doctor/profile` - Update doctor profile
- `GET /doctor/slots` - Get available appointment slots
- `PUT /doctor/slots` - Set available appointment slots
- `POST /doctor/slots/recurring` - Generate recurring appointment slots
- `GET /doctor/holidays` - Get doctor holiday schedule
- `PUT /doctor/holidays` - Set doctor holidays
- `GET /doctor/appointments` - Get doctor's appointments

## Patient Management Endpoints (`/patient`)
- `GET /patient/profile` - Get patient profile information
- `PUT /patient/profile` - Update patient profile
- `GET /patient/appointments` - Get patient's appointment history

## Messaging System Endpoints (`/message`)
- `GET /message/chats` - Get list of all chat conversations
- `GET /message` - Get message history for specific chat
- `POST /message` - Send new message
- `DELETE /message/:id` - Delete message (sender only)
- `GET /message/unread/count` - Get unread message count per chat
- `POST /message/read` - Mark messages as read

## Appointment Management Endpoints (`/appointment`)
- `POST /appointment/book` - Book new appointment with doctor (patient)
- `GET /appointment/my` - Get patient's appointment list
- `GET /appointment/:id/join` - Join consultation session (doctor/patient)
- `POST /appointment/:id/notes` - Add post-consultation notes (doctor)
- `GET /appointment/history` - Get doctor's appointment history

---

## 🆕 New Pickup Verification Endpoint Details

### `POST /ride/verify-pickup`

**Purpose**: Verify that driver has arrived at pickup location using OTP and location verification

**Authentication**: Required (Driver JWT token)

**Request Body**:
```json
{
  "rideId": "string (required)",
  "otp": "string (required, 4-digit)",
  "driverLocation": {
    "latitude": "number (required)", 
    "longitude": "number (required)"
  }
}
```

**Security Features**:
- ✅ OTP validation (must match ride OTP)
- ✅ Location verification (within 100m of pickup)
- ✅ Rate limiting (5 attempts per 10 minutes)
- ✅ OTP expiry (10 minutes)
- ✅ Driver authorization check
- ✅ Audit logging
- ✅ Real-time socket notifications

**Response Codes**:
- `200` - Pickup verified successfully
- `400` - Invalid OTP, location too far, or expired OTP
- `401` - Unauthorized driver  
- `404` - Ride not found
- `429` - Too many verification attempts
- `500` - Server error

**Side Effects**:
- Updates ride status to "ARRIVED"
- Records driver location in live tracking
- Emits real-time socket events
- Clears OTP verification attempts
- Logs verification for audit trail

---

## Authentication & Authorization

Most endpoints require JWT authentication via `Authorization: Bearer <token>` header.

**Role-based Access**:
- **Patient**: Can create rides, view own rides, book appointments
- **Driver**: Can accept rides, update status, verify pickup, manage profile  
- **Doctor**: Can manage appointments, view patient details, update availability
- **Hospital Staff**: Can access hospital dashboard, manage hospital data

## Rate Limiting

- Authentication endpoints: 5 attempts per 15 minutes
- OTP verification: 5 attempts per 10 minutes per ride
- General API: 100 requests per minute per IP

## Real-time Features

The system includes WebSocket support for:
- Live ride tracking updates
- Real-time pickup/arrival notifications  
- Hospital dashboard live data
- Message delivery notifications
- Appointment status changes
