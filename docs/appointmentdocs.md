# Appointment Management API & Features Documentation

## Overview
This document describes the REST API and backend logic for managing appointments in the InstaAid system, for both doctors and patients. All endpoints are authenticated and role-protected.

---

## Patient App Flow

### 1. Browse Doctors by Specialty
- **Endpoint:** `GET /doctors?specialty=...`
- **Purpose:** List doctors by specialty, with bios and available slots.
 - **Returns:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "doctorId",
      "user": { "_id": "userId", "name": "Dr. Smith", "email": "..." },
      "specialties": ["cardiology"],
      "bio": "...",
      "availableSlots": [ ... ]
    },
    ...
  ]
}
```

### 2. View Doctor Profile & Slots
- **Endpoint:** `GET /doctors/:id`
- **Purpose:** View doctor profile, specialties, and weekly available slots.
 - **Returns:**
```json
{
  "success": true,
  "doctor": {
    "_id": "doctorId",
    "user": { "_id": "userId", "name": "Dr. Smith", "email": "..." },
    "specialties": ["cardiology"],
    "bio": "...",
    "availableSlots": [ ... ]
  }
}
```

### 3. Book Consultation
- **Endpoint:** `POST /appointments/book`
- **Body:** `{ doctorId, date, start, end, reason }`
- **Purpose:** Book a free consultation slot with a doctor.
- **Returns:** Appointment object and confirmation.
```json
{
  "success": true,
  "appointment": {
    "_id": "appointmentId",
    "doctor": "doctorId",
    "patient": "patientId",
    "date": "2025-07-29",
    "start": "14:00",
    "end": "14:30",
    "status": "confirmed",
    "reason": "Fever"
  }
}
```

### 4. View My Appointments
- **Endpoint:** `GET /appointments/my`
- **Purpose:** List all upcoming and past appointments for the patient.
 - **Returns:**
```json
{
  "success": true,
  "appointments": [
    {
      "_id": "appointmentId",
      "doctor": { "_id": "doctorId", "user": { "name": "Dr. Smith" }, "specialties": ["cardiology"] },
      "date": "2025-07-29",
      "start": "14:00",
      "end": "14:30",
      "status": "confirmed",
      "reason": "Fever"
    },
    ...
  ]
}
```

### 5. Join Consultation Session
- **Endpoint:** `GET /appointments/:id/join`
- **Purpose:** Get video/audio session link for the appointment.
 - **Returns:**
```json
{
  "success": true,
  "room": "uniqueRoomId"
}
```

---

## Doctor App Flow

### 1. Set/Edit Weekly Availability
- **Endpoint:** `PUT /doctors/slots`
- **Body:** Array of available slots for the week.
- **Purpose:** Set or update weekly consultation slots.
 - **Returns:**
```json
{
  "success": true,
  "availableSlots": [ ... ]
}
```

### 2. View Upcoming Appointments
- **Endpoint:** `GET /doctors/appointments`
- **Purpose:** List all upcoming appointments for the doctor.
 - **Returns:**
```json
{
  "success": true,
  "appointments": [
    {
      "_id": "appointmentId",
      "patient": { "_id": "patientId", "name": "John Doe" },
      "date": "2025-07-29",
      "start": "14:00",
      "end": "14:30",
      "status": "confirmed",
      "reason": "Fever"
    },
    ...
  ]
}
```

### 3. Join Consultation Session
- **Endpoint:** `GET /appointments/:id/join`
- **Purpose:** Get video/audio session link for the appointment.
 - **Returns:**
```json
{
  "success": true,
  "room": "uniqueRoomId"
}
```

### 4. Add Post-Consultation Notes/Prescription
- **Endpoint:** `POST /appointments/:id/notes`
- **Body:** `{ notes, prescription }`
- **Purpose:** Add notes or e-prescription after the consultation.
 - **Returns:**
```json
{
  "success": true,
  "message": "Notes/prescription added",
  "appointment": {
    "_id": "appointmentId",
    "notes": "Patient recovering well.",
    "prescription": "Paracetamol 500mg",
    "status": "completed"
  }
}
```

### 5. View Consultation History
- **Endpoint:** `GET /appointments/history`
- **Purpose:** List all completed appointments and notes for the doctor.
 - **Returns:**
```json
{
  "success": true,
  "appointments": [
    {
      "_id": "appointmentId",
      "patient": { "_id": "patientId", "name": "John Doe" },
      "date": "2025-07-29",
      "start": "14:00",
      "end": "14:30",
      "status": "completed",
      "notes": "Patient recovering well.",
      "prescription": "Paracetamol 500mg"
    },
    ...
  ]
}
```

---

## Appointment Model (MongoDB)
- `doctor` (ObjectId): Reference to Doctor
- `patient` (ObjectId): Reference to User (Patient)
- `date` (String): ISO date string (YYYY-MM-DD)
- `start` (String): Start time (e.g., "14:00")
- `end` (String): End time (e.g., "14:30")
- `status` (String): Appointment status (pending, confirmed, completed, etc.)
- `reason` (String): Reason for consultation
- `notes` (String): Post-consultation notes
- `videoCallRoom` (String): Unique room/session ID for video/audio

---

## Summary Table
| Endpoint                        | Method | Role     | Returns/Effect                                 |
|----------------------------------|--------|----------|-----------------------------------------------|
| `/doctors?specialty=...`        | GET    | Patient  | List of doctors by specialty                   |
| `/doctors/:id`                  | GET    | Patient  | Doctor profile and slots                       |
| `/appointments/book`            | POST   | Patient  | Book appointment, confirmation                 |
| `/appointments/my`              | GET    | Patient  | List of patient's appointments                 |
| `/appointments/:id/join`        | GET    | Both     | Video/audio session link                       |
| `/doctors/slots`                | PUT    | Doctor   | Set or update available slots                  |
| `/doctors/appointments`         | GET    | Doctor   | List of doctor's appointments                  |
| `/appointments/:id/notes`       | POST   | Doctor   | Add notes/prescription                         |
| `/appointments/history`         | GET    | Doctor   | Completed appointments and notes               |

---

## Notes
- All endpoints require authentication.
- Role-based access is enforced (doctor/patient).
- Appointment status and slot booking are automatically managed.
- Video/audio integration can use WebRTC, Twilio, or similar services.
