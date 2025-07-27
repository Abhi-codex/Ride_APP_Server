# Telemedicine & Doctor Consultation Feature: TODO

## 1. User Management
- [ ✔️ ] Add "doctor" role to user model
- [ ✔️ ] Doctor profile: specialties, available slots/calendar, bio, etc.
- [ ✔️ ] Patient profile: (optional) medical history, contact info
- [ ✔️ ] Authentication (JWT)
- [ ✔️ ] Role-based access control for doctor/patient

## 2. Real-Time Communication (WebSockets)
- [ ] Integrate Socket.IO for doctor-patient chat and signaling
- [ ] Private chat rooms per appointment/session
- [ ] Real-time notifications (new message, appointment updates)
- [ ] WebRTC signaling events (offer, answer, ICE)

## 3. Appointment Scheduling (Free Consultations)
- [ ] Appointment model (doctor, patient, date, time, status)
- [ ] Doctor availability management (CRUD for slots)
- [ ] Patient appointment requests (with preferred time/doctor)
- [ ] Conflict checking (no double-booking)
- [ ] Appointment status updates (pending, confirmed, rescheduled, cancelled)
- [ ] Real-time sync of appointment changes via sockets

## 4. Messaging
- [ ] Message model (sender, receiver, content, timestamp, appointment reference)
- [ ] Store chat history for each appointment/session
- [ ] API endpoints for fetching chat history

## 5. Video Call (WebRTC Signaling)
- [ ] WebSocket events for offer/answer/ICE candidate exchange
- [ ] Meeting/session management (unique IDs per call)
- [ ] (Optional) Store call logs/metadata

## 6. Calendar Integration
- [ ] API endpoints for fetching doctor availability
- [ ] API endpoints for booking/rescheduling/cancelling appointments
- [ ] Timezone handling

## 7. Doctor/Patient Dashboards
- [ ] Doctor dashboard: manage requests, appointments, availability
- [ ] Patient dashboard: view upcoming/past appointments

## 8. Security & Compliance
- [ ] Input validation and sanitization
- [ ] Secure all new WebSocket and REST endpoints
- [ ] (Optional) Audit logging, rate limiting

## 9. Notifications (Optional)
- [ ] Email/SMS/push notifications for appointment reminders and updates

---

**Note:** All consultations are free, so no payment/fees model is required.
