import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";

// Get doctor profile (for current user)
export const getDoctorProfile = async (req, res) => {
  const userId = req.user.id;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  res.status(StatusCodes.OK).json({ doctor });
};

// Update doctor profile (bio, specialties)
export const updateDoctorProfile = async (req, res) => {
  const userId = req.user.id;
  const { bio, specialties } = req.body;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  if (bio !== undefined) doctor.bio = bio;
  if (specialties !== undefined) doctor.specialties = specialties;
  doctor.updatedAt = new Date();
  await doctor.save();
  res.status(StatusCodes.OK).json({ message: "Doctor profile updated", doctor });
};

// Get available slots
export const getAvailableSlots = async (req, res) => {
  const userId = req.user.id;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  res.status(StatusCodes.OK).json({ availableSlots: doctor.availableSlots });
};

// Add or update available slots (replace all slots for simplicity)
export const setAvailableSlots = async (req, res) => {
  const userId = req.user.id;
  const { availableSlots } = req.body;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  doctor.availableSlots = availableSlots;
  doctor.updatedAt = new Date();
  await doctor.save();
  res.status(StatusCodes.OK).json({ message: "Available slots updated", availableSlots: doctor.availableSlots });
};

// Get all appointments for doctor
export const getDoctorAppointments = async (req, res) => {
  const userId = req.user.id;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  const appointments = await Appointment.find({ doctor: doctor._id }).populate("patient", "name email phone");
  res.status(StatusCodes.OK).json({ appointments });
};
