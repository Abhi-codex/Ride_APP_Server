# Doctor App Development To-Do

## 1. Registration & Authentication
- [ ✔️ ] Implement doctor registration with mobile number (OTP verification via backend; suggest free solution like sending OTP via email for dev/testing, or use services like Firebase Auth SMS for free tier)
- [ ✔️ ] Store doctor user in database (role: doctor)
- [ ✔️ ] Login flow for doctors (mobile number + OTP)
- [ ✔️ ] Add endpoints:
    - `POST /auth/send-otp` (send OTP)
    - `POST /auth/verify-otp` (verify OTP)

## 2. Doctor Profile Form
- [ ✔️ ] After registration, show profile form
    - Fields: Name, Email, Mobile, Specialties (cardiac, trauma, respiratory, neurological, pediatric, obstetric, psychiatric, burns, poisoning, general), Bio, Qualifications, Experience, Clinic Address, etc.
    - Validate and save profile details
    - Use fields as described in appointment docs
- [ ✔️ ] API: `PUT /doctors/profile` (edit profile)
- [ ✔️ ] Doctors can edit profile after registration

## 3. Weekly Availability (Calendar)
- [ ✔️ ] Tab: Calendar/Availability
- [ ✔️ ] UI to set/edit weekly slots (date, start, end)
- [ ✔️ ] API: `PUT /doctors/slots` (send array of slots)
- [ ✔️ ] Show existing slots (GET `/doctors/slots`)
- [ ✔️ ] Set recurring availability/holidays
- [ ✔️ ] Block out holidays/unavailable dates (API: `PUT /doctors/holidays`, `GET /doctors/holidays`)
- [ ✔️ ] Ensure blocked dates reflect for patients (API: `GET /doctors/:id/availability`)

## 4. View Upcoming Appointments
- [ ] Tab: Appointments
- [ ] List all upcoming appointments (GET `/doctors/appointments`)
- [ ] Show patient details, date, time, status
- [ ] Option to join consultation session (GET `/appointments/:id/join`)
- [ ] Accept/reject/postpone/prepone appointment requests (API: `POST /appointments/:id/respond`)

## 5. Consultation Session
- [ ] Integrate video/audio session (WebRTC)
- [ ] Use room ID from API response

## 6. Post-Consultation Notes/Prescription
- [ ] After session, show form for notes/prescription
- [ ] API: `POST /appointments/:id/notes`
- [ ] Show completed appointments and notes (GET `/appointments/history`)

## 7. Messaging (Socket.IO)
- [ ] Setup Socket.IO client for real-time chat (only for booked appointments, allow follow-up after appointment)
- [ ] Join chat room per appointment/user (`joinChat` event)
- [ ] Send/receive messages (`sendMessage`, `newMessage` events)
- [ ] Fetch chat history (REST: GET `/messages?appointmentId=...`)
- [ ] Show unread count, mark as read
- [ ] UI for chat between doctor and patient
- [ ] Text and emoji support only (no file attachments for now)

## 8. Notifications & Reminders
- [ ] Real-time notifications via Socket.IO
- [ ] Push notifications (mobile)
- [ ] Appointment reminders (push and SMS if possible)
- [ ] Notification section: show new appointment requests, message notifications, reminders
- [ ] API: `GET /notifications`, `POST /notifications/mark-read`, `POST /appointments/:id/reminder`

## 9. General UI/UX
- [ ] Tabs: Profile, Calendar, Appointments, Messages, Notifications, Dashboard
- [ ] Responsive, clean, modern design (Uber-like)
- [ ] Error handling, loading states

## 10. Analytics & Dashboard
- [ ] Dashboard section for previous appointments
- [ ] Export appointment history/analytics (CSV/PDF if feasible)
- [ ] API: `GET /doctors/analytics`
- [ ] Feedback analytics (add later)

## 11. Backend/API Integration
- [ ] Connect all API endpoints as per docs and new requirements
- [ ] Handle authentication tokens
- [ ] Role-based access (doctor only)

## 12. Testing & Validation
- [ ] Test registration, profile, slots, appointments, messaging, notifications
- [ ] Validate all API responses and error cases

---

## Additional Backend Endpoints Needed
- `POST /auth/send-otp` (send OTP)
- `POST /auth/verify-otp` (verify OTP)
- `PUT /doctors/profile` (edit profile)
- `PUT /doctors/slots` (set availability)
- `PUT /doctors/holidays` (set holidays)
- `GET /doctors/holidays` (get holidays)
- `POST /appointments/:id/respond` (accept/reject/postpone/prepone)
- `POST /appointments/:id/reminder` (set reminder)
- `GET /notifications` (fetch notifications)
- `POST /notifications/mark-read` (mark as read)
- `GET /doctors/analytics` (dashboard)
- `GET /appointments/history` (completed appointments)
- `GET /appointments/:id/join` (consultation session)

---

## Notes
- Use free backend OTP solution for dev/testing (e.g., email OTP, Firebase Auth SMS free tier)
- All notifications should be real-time (Socket.IO) and push notifications (mobile)
- No file attachments in chat for now
- No admin features needed
- No multi-language support for now
- All consultations are free; feedback analytics to be added later
- Appointment reminders via push and SMS if possible
- Recurring availability/holidays: add support if feasible
- Export history/analytics: add CSV/PDF export if not complex

---

## Next Steps
- Confirm backend endpoints and update API docs
- Start with registration/authentication and profile flow
- Design UI wireframes for main tabs
- Implement calendar/availability and appointment management
- Integrate messaging and notifications (Socket.IO, push)
- Build dashboard and export features
- Test all flows and validate with sample data


## Questions for You
1. Should registration use OTP or password, or both?
-> the registration must use otps that will be enough but what service will be used or can that be done by the backend only or is an SMTP server required to be setup?

2. What specialties should be available for doctors to select?
-> these are the main types of emergencies that i have listen in my patients app:  | 'cardiac'
  | 'trauma'
  | 'respiratory'
  | 'neurological'
  | 'pediatric'
  | 'obstetric'
  | 'psychiatric'
  | 'burns'
  | 'poisoning'
  | 'general'

3. Should doctors be able to edit their profile after registration?
-> yes they must have that ability.

4. What video/audio provider do you prefer (WebRTC, Twilio, etc.)?
-> i want to use webRTC.

5. Should chat be available only for booked appointments, or for any user?
-> chats must be available for only appointment booked patients and suppose in future after the appointment is over they must still be able to chat with the doctors for further follow ups or queries.

6. Any specific UI/UX requirements or design system to follow?
-> you can keep the design very simple but clean and modern. you can make the design look like how uber is.

7. Should doctors get notifications for new appointments/messages?
-> yes there must be a notifications section and upon any request for appointment raised from the patients app must be shown here and the doctor must either accept it or reject it there must also be an option to postpon or prepon a scheduled appointment. also similarly message notifications must also be shown relevantly.

8. Any additional features (file attachments in chat, appointment reminders, etc.)?
-> yes appointment reminders in the notification section.

9. Should doctors be able to block out holidays/unavailable dates in calendar?
-> yes and it must reflect on the patient side as well.

10. Any analytics or dashboard features needed for doctors?
-> a section to display some details about the previous appointments.


-->> please ask more thing if required also please update the todo list accordingly further i have my backend on node and database on mongo you please tell me apart from what endpoints that currently are there as per the docs and what more must i add.


## Questions for Further Clarification:

1. Which SMS provider do you want for OTP (Twilio, AWS SNS, etc.), or should I suggest a simple backend solution?
-> in future i will like to use this https://2factor.in/v3/bulk-sms-pricing but right now can you please suggest me some free backend solution.

2. Should notifications be real-time (Socket.IO) or just REST API polling?
-> yes real time via socket.io

3. For analytics, what specific metrics do you want (e.g., revenue, patient feedback, etc.)?
-> no revenue all consultations will be free. only analytics for feedback but later on not now.

4. Should doctors be able to export their appointment history or analytics (CSV/PDF)?
-> yes if that is not a big deal to implement.

5. Do you want push notifications (mobile) or just in-app notifications?
-> i want push notifications. 

6. Should file attachments in chat support images, PDFs, or other formats?
-> no normal texts and maybe emojis will work for now. 

7. Any role-based admin features needed (e.g., admin can view/edit doctors)?
-> no not yet.

8. Should doctors be able to set recurring availability/holidays?
-> yes maybe!

9. Any need for multi-language/localization support?
-> no but i will use google translate api for that later on.

10. Should appointment reminders be sent via SMS, email, or just in-app?
-> via sms as well apart from app push notifications if possible. but still push notifications will work.