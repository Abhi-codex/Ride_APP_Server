import Appointment from "../models/Appointment.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";

// Get patient profile (core + patient-specific)
export const getPatientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("-__v");
    if (!user || user.role !== "patient") throw new BadRequestError("Patient not found");
    
    let patient = await Patient.findOne({ user: userId }).select("-__v");
    if (!patient) {
      // Create empty patient profile if it doesn't exist
      patient = new Patient({ user: userId });
      await patient.save();
    }

    // Return combined user and patient data
    const combinedProfile = {
      ...user.toObject(),
      ...patient.toObject(),
      _id: user._id, // Ensure we use user's _id
      // Convert dateOfBirth to age for frontend compatibility
      age: patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : null
    };

    res.status(StatusCodes.OK).json({
      message: "Patient profile retrieved successfully",
      user: combinedProfile
    });
  } catch (error) {
    console.error('Get patient profile error:', error);
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message || "Failed to get patient profile"
    });
  }
};

// Update patient profile (core + patient-specific)
export const updatePatientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      name, 
      email, 
      address, 
      dateOfBirth, 
      age, // Convert age to dateOfBirth
      gender, 
      bloodGroup, 
      allergies, 
      medicalHistory, 
      medicalConditions, // Convert to medicalHistory
      emergencyContacts,
      emergencyContact // Convert single contact to array
    } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== "patient") throw new BadRequestError("Patient not found");
    
    // Update User fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    user.profileCompleted = true;
    await user.save();

    // Find or create Patient profile
    let patient = await Patient.findOne({ user: userId });
    if (!patient) {
      patient = new Patient({ user: userId });
    }

    // Update Patient fields
    if (address !== undefined) patient.address = address;
    if (dateOfBirth !== undefined) patient.dateOfBirth = new Date(dateOfBirth);
    
    // Convert age to dateOfBirth if provided
    if (age !== undefined && !dateOfBirth) {
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - parseInt(age);
      patient.dateOfBirth = new Date(`${birthYear}-01-01`);
    }
    
    if (gender !== undefined) patient.gender = gender;
    if (bloodGroup !== undefined) patient.bloodGroup = bloodGroup;
    
    // Handle allergies (convert string to array if needed)
    if (allergies !== undefined) {
      if (typeof allergies === 'string') {
        patient.allergies = allergies === 'None' || allergies === '' ? [] : [allergies];
      } else if (Array.isArray(allergies)) {
        patient.allergies = allergies;
      }
    }
    
    // Handle medical conditions/history
    if (medicalConditions !== undefined || medicalHistory !== undefined) {
      const conditions = medicalConditions || medicalHistory;
      if (typeof conditions === 'string') {
        if (conditions !== 'None' && conditions !== '') {
          patient.medicalHistory = [{
            condition: conditions,
            details: '',
            diagnosedAt: new Date(),
            isChronic: false
          }];
        } else {
          patient.medicalHistory = [];
        }
      } else if (Array.isArray(conditions)) {
        patient.medicalHistory = conditions;
      }
    }
    
    // Handle emergency contacts
    if (emergencyContacts !== undefined) {
      patient.emergencyContacts = emergencyContacts;
    } else if (emergencyContact !== undefined) {
      // Convert single emergency contact to array format
      patient.emergencyContacts = [{
        name: 'Emergency Contact',
        phone: emergencyContact,
        relation: 'Emergency'
      }];
    }
    
    patient.updatedAt = new Date();
    await patient.save();

    // Return combined user and patient data
    const combinedProfile = {
      ...user.toObject(),
      ...patient.toObject(),
      _id: user._id // Ensure we use user's _id
    };

    res.status(StatusCodes.OK).json({ 
      message: "Patient profile updated successfully", 
      user: combinedProfile 
    });
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message || "Failed to update patient profile"
    });
  }
};

// Get all appointments for patient
export const getPatientAppointments = async (req, res) => {
  const userId = req.user.id;
  const appointments = await Appointment.find({ patient: userId }).populate("doctor");
  res.status(StatusCodes.OK).json({ appointments });
};
