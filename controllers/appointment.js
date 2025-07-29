import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";

// Book an appointment (patient)
export const bookAppointment = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, date, start, end, reason } = req.body;
  if (!doctorId || !date || !start || !end) throw new BadRequestError("Missing required fields");
  // Check doctor exists
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new BadRequestError("Doctor not found");
  // Check slot availability
  let slotFound = false;
  for (const day of doctor.availableSlots) {
    if (day.date === date) {
      for (const slot of day.slots) {
        if (slot.start === start && slot.end === end && !slot.isBooked) {
          slot.isBooked = true;
          slot.appointment = null; // Will set after appointment creation
          slotFound = true;
          break;
        }
      }
    }
  }
  if (!slotFound) throw new BadRequestError("Selected slot is not available");
  // Create appointment
  const appointment = await Appointment.create({
    doctor: doctorId,
    patient: patientId,
    date,
    start,
    end,
    status: "confirmed",
    reason
  });
  // Link slot to appointment
  for (const day of doctor.availableSlots) {
    if (day.date === date) {
      for (const slot of day.slots) {
        if (slot.start === start && slot.end === end) {
          slot.appointment = appointment._id;
        }
      }
    }
  }
  await doctor.save();
  res.status(StatusCodes.CREATED).json({ appointment });
};

// Get appointments for patient
export const getPatientAppointments = async (req, res) => {
  const patientId = req.user.id;
  const appointments = await Appointment.find({ patient: patientId }).populate("doctor", "user specialties bio");
  res.status(StatusCodes.OK).json({ appointments });
};

// Join consultation session (returns video/audio room info)
export const joinAppointmentSession = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const appointment = await Appointment.findById(id);
  if (!appointment) throw new BadRequestError("Appointment not found");
  // Check user is doctor or patient in this appointment
  if (String(appointment.patient) !== String(userId) && String(appointment.doctor) !== String(userId)) {
    throw new BadRequestError("Not authorized for this appointment");
  }
  res.status(StatusCodes.OK).json({ room: appointment.videoCallRoom });
};

// Add post-consultation notes/prescription (doctor only)
export const addAppointmentNotes = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { notes, prescription } = req.body;
  const appointment = await Appointment.findById(id);
  if (!appointment) throw new BadRequestError("Appointment not found");
  // Check user is doctor
  if (String(appointment.doctor) !== String(userId)) {
    throw new BadRequestError("Only doctor can add notes/prescription");
  }
  appointment.notes = notes;
  if (prescription) appointment.prescription = prescription;
  appointment.status = "completed";
  await appointment.save();
  res.status(StatusCodes.OK).json({ message: "Notes/prescription added", appointment });
};

// Get appointment history for doctor
export const getDoctorAppointmentHistory = async (req, res) => {
  const userId = req.user.id;
  const appointments = await Appointment.find({ doctor: userId, status: "completed" }).populate("patient", "name email phone");
  res.status(StatusCodes.OK).json({ appointments });
};
