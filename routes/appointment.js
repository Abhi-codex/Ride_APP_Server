import express from "express";
import auth from "../middleware/authentication.js";
import requireRole from "../middleware/requireRole.js";
import { bookAppointment, getPatientAppointments, joinAppointmentSession, addAppointmentNotes, getDoctorAppointmentHistory } from "../controllers/appointment.js";

const router = express.Router();

// Book an appointment (patient)
router.post("/book", auth, requireRole("patient"), bookAppointment);

// Get appointments for patient
router.get("/my", auth, requireRole("patient"), getPatientAppointments);

// Join consultation session (doctor or patient)
router.get("/:id/join", auth, joinAppointmentSession);

// Add post-consultation notes/prescription (doctor only)
router.post("/:id/notes", auth, requireRole("doctor"), addAppointmentNotes);

// Get appointment history for doctor
router.get("/history", auth, requireRole("doctor"), getDoctorAppointmentHistory);

export default router;
