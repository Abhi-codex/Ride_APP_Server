# Ride Cancellation Notifications & Responses

## Overview
This document details the complete notification system when rides are cancelled by either the driver or patient, including Socket.IO events, API responses, and fee calculations.

## 📢 Cancellation Notification Flow

### When Patient Cancels the Ride

#### **🔄 Notifications Sent to Driver:**
```javascript
// Socket.IO Notification to Driver
socket.emit('rideNotification', {
  type: 'ride_cancelled_by_patient',
  title: 'Ride Cancelled',
  message: `Patient has cancelled the ride to ${ride.drop.address}`,
  rideId: ride._id,
  data: {
    cancellationFee,           // Fee charged to patient (₹0-₹150)
    reason: cancelReason       // Reason provided by patient
  }
});
```

#### **📡 API Response to Patient:**
```json
{
  "success": true,
  "message": "Ride cancelled successfully",
  "data": {
    "rideId": "ride_id_here",
    "status": "CANCELLED",
    "cancellationDetails": {
      "cancelledBy": "patient",
      "cancelledAt": "2025-09-27T10:30:00.000Z",
      "reason": "User provided reason",
      "cancellationFee": 25,
      "refundAmount": 475
    }
  }
}
```

---

### When Driver Cancels the Ride

#### **🔄 Notifications Sent to Patient:**
```javascript
// Socket.IO Notification to Patient
socket.emit('rideNotification', {
  type: 'ride_cancelled_by_driver',
  title: 'Ride Cancelled',
  message: `Driver has cancelled your ride. We're finding you another ambulance.`,
  rideId: ride._id,
  data: {
    reason: cancelReason       // Reason provided by driver
  }
});
```

#### **📡 API Response to Driver:**
```json
{
  "success": true,
  "message": "Ride cancelled successfully",
  "data": {
    "rideId": "ride_id_here",
    "status": "CANCELLED",
    "cancellationDetails": {
      "cancelledBy": "driver",
      "cancelledAt": "2025-09-27T10:30:00.000Z",
      "reason": "Driver provided reason",
      "cancellationFee": 0,      // Drivers don't pay cancellation fees
      "refundAmount": 500        // Full refund to patient
    }
  }
}
```

---

## 📡 Socket.IO Events

### General Ride Cancellation Event
**Sent to all ride room subscribers (both driver and patient):**
```javascript
socket.to(`ride_${rideId}`).emit('rideCancelled', {
  rideId: ride._id,
  status: 'CANCELLED',
  cancelledBy,                    // 'patient' or 'driver'
  cancelReason: ride.cancellation.cancelReason,
  cancellationFee,
  timestamp: ride.cancellation.cancelledAt
});
```

---

## 💰 Cancellation Fee Matrix

| Canceller | Fee Applied To | Fee Amount | Refund To Patient | Notes |
|-----------|----------------|------------|-------------------|-------|
| **Patient** | Patient | ₹0-₹150 (status-based) | `fare - cancellationFee` | Fee depends on ride status |
| **Driver** | None | ₹0 | Full fare refund | Drivers never pay fees |

### Fee Calculation by Status:
- **SEARCHING_FOR_RIDER**: ₹0
- **START**: 10% of fare (max ₹50)
- **ARRIVED**: 20% of fare (max ₹100)
- **PICKUP_COMPLETE**: 25% of fare (max ₹150)

---

## 📱 Frontend Implementation Examples

### Patient App - Handling Driver Cancellation
```javascript
socket.on('rideNotification', (notification) => {
  if (notification.type === 'ride_cancelled_by_driver') {
    // Show cancellation alert
    showAlert({
      type: 'warning',
      title: notification.title,
      message: notification.message
    });

    // Update ride status to cancelled
    updateRideStatus('CANCELLED');

    // Show "Find new ambulance" option
    showFindNewAmbulanceButton();

    // Log for analytics
    trackEvent('ride_cancelled_by_driver', {
      rideId: notification.rideId,
      reason: notification.data.reason
    });
  }
});

// Also listen for general cancellation event
socket.on('rideCancelled', (data) => {
  if (data.cancelledBy === 'driver') {
    // Handle general cancellation logic
    updateRideStatus('CANCELLED');
    navigateToRideHistory();
  }
});
```

### Driver App - Handling Patient Cancellation
```javascript
socket.on('rideNotification', (notification) => {
  if (notification.type === 'ride_cancelled_by_patient') {
    // Show cancellation with fee info
    showAlert({
      type: 'info',
      title: notification.title,
      message: `${notification.message}\nFee charged: ₹${notification.data.cancellationFee}`,
      details: `Reason: ${notification.data.reason}`
    });

    // Update ride status
    updateRideStatus('CANCELLED');

    // Make driver available for new rides
    setDriverStatus('available');

    // Update earnings (if applicable)
    updateDriverEarnings(notification.data.cancellationFee);

    // Log for analytics
    trackEvent('ride_cancelled_by_patient', {
      rideId: notification.rideId,
      fee: notification.data.cancellationFee,
      reason: notification.data.reason
    });
  }
});

// Also listen for general cancellation event
socket.on('rideCancelled', (data) => {
  if (data.cancelledBy === 'patient') {
    // Handle general cancellation logic
    updateRideStatus('CANCELLED');
    showAvailableRides();
  }
});
```

---

## 🔄 Complete Notification Flow

### Patient Cancellation Flow:
1. **Patient initiates cancellation** → API call to `PUT /ride/:rideId/cancel`
2. **Backend processes cancellation** → Calculates fees, updates status
3. **Driver receives notification** → `rideNotification` with type `ride_cancelled_by_patient`
4. **Both parties receive** → `rideCancelled` event in ride room
5. **Patient receives** → API response with cancellation details

### Driver Cancellation Flow:
1. **Driver initiates cancellation** → API call to `PUT /ride/:rideId/cancel`
2. **Backend processes cancellation** → No fees charged, full refund
3. **Patient receives notification** → `rideNotification` with type `ride_cancelled_by_driver`
4. **Both parties receive** → `rideCancelled` event in ride room
5. **Driver receives** → API response with cancellation details

---

## 🚨 Error Handling

### Cancellation API Errors
```javascript
const cancelRide = async (rideId, reason) => {
  try {
    const response = await fetch(`/ride/${rideId}/cancel`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Cancel ride failed:', error);

    // Show user-friendly error message
    showAlert({
      type: 'error',
      title: 'Cancellation Failed',
      message: error.message || 'Unable to cancel ride. Please try again.'
    });

    throw error;
  }
};
```

### Socket.IO Connection Issues
```javascript
socket.on('connect_error', (error) => {
  console.error('Socket connection failed:', error);
  // Fallback: Poll API for cancellation status
  startCancellationStatusPolling(rideId);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected during cancellation');
  // Continue with API polling until reconnection
});
```

---

## 📋 Testing Scenarios

### ✅ Patient Cancellation Tests:
- [ ] Patient cancels during SEARCHING_FOR_RIDER (₹0 fee)
- [ ] Patient cancels during START (₹50 max fee)
- [ ] Patient cancels during ARRIVED (₹100 max fee)
- [ ] Patient cancels during PICKUP_COMPLETE (₹150 max fee)
- [ ] Driver receives correct notification
- [ ] Both parties receive rideCancelled event

### ✅ Driver Cancellation Tests:
- [ ] Driver cancels ride (₹0 fee to driver)
- [ ] Patient receives correct notification
- [ ] Patient gets full refund
- [ ] Both parties receive rideCancelled event
- [ ] Driver becomes available for new rides

### ✅ Error Handling Tests:
- [ ] Network failure during cancellation
- [ ] Socket.IO disconnection handling
- [ ] Invalid ride ID handling
- [ ] Unauthorized cancellation attempts

---

## 🔧 API Endpoints

### Cancel Ride
```http
PUT /ride/:rideId/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Optional cancellation reason"
}
```

### Check Cancellation Eligibility
```http
GET /ride/:rideId/can-cancel
Authorization: Bearer <token>
```

---

## 💡 Best Practices

1. **Always show cancellation fees** before confirming cancellation
2. **Provide clear cancellation reasons** for better user experience
3. **Handle Socket.IO disconnections** gracefully with API polling fallback
4. **Update UI immediately** on successful cancellation
5. **Log cancellation events** for analytics and dispute resolution
6. **Test all cancellation scenarios** thoroughly
7. **Handle edge cases** like double-cancellation attempts

---

## 📊 Analytics & Monitoring

### Track Cancellation Events:
```javascript
// For patient cancellations
analytics.track('ride_cancelled', {
  cancelledBy: 'patient',
  rideId: rideId,
  status: currentStatus,
  fee: cancellationFee,
  reason: reason
});

// For driver cancellations
analytics.track('ride_cancelled', {
  cancelledBy: 'driver',
  rideId: rideId,
  status: currentStatus,
  reason: reason
});
```

### Monitor Cancellation Rates:
- Track cancellation rates by status
- Monitor fee collection vs refunds
- Analyze cancellation reasons
- Identify problematic routes/times
