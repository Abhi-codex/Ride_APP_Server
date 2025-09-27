# 🚑 Ambulance Ride Status Guide

## Overview
This document outlines all available ride status enums, their meanings, and how to handle them in the patient app frontend.

## 📊 Ride Status Enums

| Status | Display Text | Description | User Action Required |
|--------|-------------|-------------|---------------------|
| `SEARCHING_FOR_RIDER` | "Searching for ambulance..." | Ride created, waiting for driver assignment | Wait |
| `START` | "Ambulance en route" | Driver assigned and heading to pickup location | Wait |
| `ARRIVED` | "Ambulance has arrived" | Driver has arrived at pickup location | Wait for pickup |
| `PICKUP_COMPLETE` | "Patient picked up - en route to destination" | Patient picked up, heading to destination | Wait |
| `DROPOFF_COMPLETE` | "Arrived at destination" | Arrived at hospital/destination | Confirm completion |
| `COMPLETED` | "Trip completed" | Ride successfully completed | Rate the service |
| `CANCELLED` | "Trip cancelled" | Ride was cancelled | Check cancellation details |

## 🎯 Status Flow Diagram

```
SEARCHING_FOR_RIDER → START → ARRIVED → PICKUP_COMPLETE → DROPOFF_COMPLETE → COMPLETED
                       ↓         ↓                                                ↓
                   CANCELLED CANCELLED                                       CANCELLED
```

## 💰 Cancellation Policies

| Status | Fee | Max Amount | Description |
|--------|-----|------------|-------------|
| `SEARCHING_FOR_RIDER` | ₹0 | - | No fee - ambulance not yet assigned |
| `START` | 10% | ₹50 | Ambulance en route |
| `ARRIVED` | 20% | ₹100 | Ambulance has arrived at pickup |
| `PICKUP_COMPLETE` | 25% | ₹150 | Patient picked up, en route to destination |

## 🔄 Socket.IO Events

### Connection Setup
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' },
  withCredentials: true
});

// Subscribe to ride updates
socket.on('connect', () => {
  socket.emit('subscribeRide', rideId);
});
```

### Ride Status Updates
```javascript
// Listen for ride status changes
socket.on('rideUpdate', (rideData) => {
  console.log('Ride status updated:', rideData.status);
  updateRideStatusInUI(rideData);
});

// Listen for specific notifications
socket.on('rideNotification', (notification) => {
  handleRideNotification(notification);
});
```

### Ride Acceptance
```javascript
socket.on('rideAccepted', (data) => {
  console.log('Ride accepted by driver');
  // Update UI to show driver is assigned
});
```

## 📱 Frontend Implementation Guide

### 1. Status Display Logic
```javascript
const getStatusConfig = (status) => {
  const configs = {
    'SEARCHING_FOR_RIDER': {
      color: 'orange',
      icon: 'search',
      message: 'Finding your ambulance...',
      showCancelButton: true
    },
    'START': {
      color: 'blue',
      icon: 'car',
      message: 'Ambulance is on the way',
      showCancelButton: true
    },
    'ARRIVED': {
      color: 'green',
      icon: 'map-pin',
      message: 'Ambulance has arrived',
      showCancelButton: true
    },
    'PICKUP_COMPLETE': {
      color: 'blue',
      icon: 'user-check',
      message: 'Patient picked up, heading to destination',
      showCancelButton: true
    },
    'DROPOFF_COMPLETE': {
      color: 'green',
      icon: 'check-circle',
      message: 'Arrived at destination',
      showCancelButton: false
    },
    'COMPLETED': {
      color: 'green',
      icon: 'star',
      message: 'Ride completed successfully',
      showCancelButton: false,
      showRatingForm: true
    },
    'CANCELLED': {
      color: 'red',
      icon: 'x-circle',
      message: 'Ride was cancelled',
      showCancelButton: false
    }
  };
  return configs[status] || { color: 'gray', icon: 'help-circle', message: status };
};
```

### 2. Notification Handling
```javascript
const handleRideNotification = (notification) => {
  const { type, title, message, rideId, data } = notification;

  switch (type) {
    case 'ride_accepted':
      showToast('success', title, message);
      // Update UI to show driver details
      break;

    case 'pickup_completed':
      showToast('info', title, message);
      // Update status to show en route to destination
      break;

    case 'dropoff_completed':
      showToast('success', title, message);
      // Show completion confirmation
      break;

    case 'ride_cancelled_by_driver':
      showToast('warning', title, message);
      // Handle ride cancellation by driver
      break;

    case 'ride_cancelled_by_patient':
      // This shouldn't happen for patient app
      break;

    default:
      showToast('info', title, message);
  }
};
```

### 3. Cancel Button Logic
```javascript
const canCancelRide = (status) => {
  const cancellableStatuses = [
    'SEARCHING_FOR_RIDER',
    'START',
    'ARRIVED',
    'PICKUP_COMPLETE'
  ];
  return cancellableStatuses.includes(status);
};

const handleCancelRide = async (rideId, status) => {
  if (!canCancelRide(status)) {
    showToast('error', 'Cannot Cancel', 'This ride cannot be cancelled at this stage');
    return;
  }

  // Show confirmation dialog with cancellation fee info
  const feeInfo = getCancellationFeeInfo(status);
  const confirmed = await showCancelConfirmation(feeInfo);

  if (confirmed) {
    try {
      await cancelRideAPI(rideId);
      showToast('success', 'Ride Cancelled', 'Your ride has been cancelled');
    } catch (error) {
      showToast('error', 'Cancellation Failed', error.message);
    }
  }
};
```

### 4. Cancellation Fee Display
```javascript
const getCancellationFeeInfo = (status) => {
  const policies = {
    'SEARCHING_FOR_RIDER': { fee: 0, description: 'No cancellation fee' },
    'START': { fee: '10%', max: '₹50', description: 'Ambulance en route' },
    'ARRIVED': { fee: '20%', max: '₹100', description: 'Ambulance has arrived' },
    'PICKUP_COMPLETE': { fee: '25%', max: '₹150', description: 'Patient picked up' }
  };
  return policies[status] || { fee: 'N/A', description: 'Unknown status' };
};
```

## 🔧 API Endpoints

### Check Cancellation Eligibility
```javascript
GET /ride/:rideId/can-cancel
```
Response:
```json
{
  "success": true,
  "data": {
    "rideId": "...",
    "canCancel": true,
    "currentStatus": "START",
    "cancellationFee": 25,
    "cancellationPolicy": {
      "fee": 25,
      "refund": 475,
      "description": "Cancellation fee: ₹25 - ambulance en route"
    }
  }
}
```

### Cancel Ride
```javascript
PUT /ride/:rideId/cancel
Body: { "reason": "Optional cancellation reason" }
```

### Get Ride Details
```javascript
GET /ride/:rideId
```
Response includes:
```json
{
  "status": "START",
  "statusInfo": {
    "current": "START",
    "displayText": "Ambulance en route",
    "isActive": true,
    "canCancel": true
  },
  "canBeCancelled": true,
  "cancellationPolicy": {
    "fee": 25,
    "refund": 475,
    "description": "Cancellation fee: ₹25 - ambulance en route"
  }
}
```

## 🎨 UI State Management

### React Example
```javascript
const [rideStatus, setRideStatus] = useState('SEARCHING_FOR_RIDER');
const [rideData, setRideData] = useState(null);

// Update status when Socket.IO event received
useEffect(() => {
  socket.on('rideUpdate', (data) => {
    setRideStatus(data.status);
    setRideData(data);
  });

  return () => socket.off('rideUpdate');
}, []);

// Get current status configuration
const statusConfig = getStatusConfig(rideStatus);
```

## 🚨 Error Handling

### Socket.IO Connection Issues
```javascript
socket.on('connect_error', (error) => {
  console.error('Socket connection failed:', error);
  // Fallback to polling API for status updates
  startPollingRideStatus();
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  // Continue with polling until reconnection
});
```

### API Error Handling
```javascript
const cancelRide = async (rideId) => {
  try {
    const response = await fetch(`/ride/${rideId}/cancel`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'User cancelled' })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Cancel ride failed:', error);
    throw error;
  }
};
```

## 📋 Testing Checklist

- [ ] Status transitions work correctly
- [ ] Socket.IO events are received
- [ ] Cancellation works at appropriate stages
- [ ] Fee calculations are correct
- [ ] Notifications display properly
- [ ] UI updates on status changes
- [ ] Error states are handled
- [ ] Offline/online state management

## 🔄 Status Transition Rules

1. **SEARCHING_FOR_RIDER** → **START**: Driver accepts ride
2. **START** → **ARRIVED**: Driver arrives at pickup
3. **ARRIVED** → **PICKUP_COMPLETE**: Driver picks up patient
4. **PICKUP_COMPLETE** → **DROPOFF_COMPLETE**: Driver arrives at destination
5. **DROPOFF_COMPLETE** → **COMPLETED**: Ride marked as completed
6. Any active status → **CANCELLED**: Ride cancelled (with fees)

## 💡 Best Practices

1. **Always check `canCancel` before showing cancel button**
2. **Display cancellation fees clearly before confirmation**
3. **Use Socket.IO for real-time updates, fallback to polling**
4. **Handle all status transitions gracefully**
5. **Show appropriate loading states during API calls**
6. **Provide clear feedback for all user actions**
7. **Test all status transitions thoroughly**

---