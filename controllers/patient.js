import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";

// Get patient profile (core + patient-specific)
export const getPatientProfile = async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).select("-__v");
  if (!user || user.role !== "patient") throw new BadRequestError("Patient not found");
  const patient = await Patient.findOne({ user: userId }).select("-__v");
  if (!patient) throw new BadRequestError("Patient profile not found");
  res.status(StatusCodes.OK).json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      ...patient.toObject(),
    }
  });
};

// Update patient profile (core + patient-specific)
export const updatePatientProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, email, address, dateOfBirth, gender, bloodGroup, allergies, medicalHistory, emergencyContacts } = req.body;
  const user = await User.findById(userId);
  if (!user || user.role !== "patient") throw new BadRequestError("Patient not found");
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  await user.save();
  let patient = await Patient.findOne({ user: userId });
  if (!patient) throw new BadRequestError("Patient profile not found");
  if (address !== undefined) patient.address = address;
  if (dateOfBirth !== undefined) patient.dateOfBirth = dateOfBirth;
  if (gender !== undefined) patient.gender = gender;
  if (bloodGroup !== undefined) patient.bloodGroup = bloodGroup;
  if (allergies !== undefined) patient.allergies = allergies;
  if (medicalHistory !== undefined) patient.medicalHistory = medicalHistory;
  if (emergencyContacts !== undefined) patient.emergencyContacts = emergencyContacts;
  patient.updatedAt = new Date();
  await patient.save();
  res.status(StatusCodes.OK).json({ message: "Patient profile updated", user: { ...user.toObject(), ...patient.toObject() } });
};

// Get all appointments for patient
export const getPatientAppointments = async (req, res) => {
  const userId = req.user.id;
  const appointments = await Appointment.find({ patient: userId }).populate("doctor");
  res.status(StatusCodes.OK).json({ appointments });
};
