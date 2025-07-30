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

export const updateDoctorProfile = async (req, res) => {
  const userId = req.user.id;
  // Accept all updatable fields from Doctor model except phone and user
  const {
    name,
    email,
    specialties,
    bio,
    qualifications,
    experience,
    clinicAddress,
    availableSlots
  } = req.body;
  console.log(`[DoctorProfileUpdate] Searching for doctor profile with userId: ${userId}`);
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    console.error(`[DoctorProfileUpdate] Doctor profile not found for userId: ${userId}`);
    throw new BadRequestError("Doctor profile not found");
  }
  console.log(`[DoctorProfileUpdate] Doctor profile found:`, doctor);
  if (typeof name === "string") doctor.name = name;
  if (typeof email === "string") doctor.email = email;
  if (Array.isArray(specialties)) doctor.specialties = specialties;
  if (typeof bio === "string") doctor.bio = bio;
  if (typeof qualifications === "string") doctor.qualifications = qualifications;
  if (typeof experience === "string") doctor.experience = experience;
  if (typeof clinicAddress === "string") doctor.clinicAddress = clinicAddress;
  if (Array.isArray(availableSlots)) doctor.availableSlots = availableSlots;
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
