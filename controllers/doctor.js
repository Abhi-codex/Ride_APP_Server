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
  
  // Validate slots format
  if (!Array.isArray(availableSlots)) {
    throw new BadRequestError("Available slots must be an array");
  }
  
  // Validate each slot entry
  for (const daySlots of availableSlots) {
    if (!daySlots.date || !Array.isArray(daySlots.slots)) {
      throw new BadRequestError("Each day must have date and slots array");
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(daySlots.date)) {
      throw new BadRequestError("Date must be in YYYY-MM-DD format");
    }
    
    // Validate time slots
    for (const slot of daySlots.slots) {
      if (!slot.start || !slot.end) {
        throw new BadRequestError("Each slot must have start and end time");
      }
      // Validate time format (HH:MM)
      if (!/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end)) {
        throw new BadRequestError("Time must be in HH:MM format");
      }
    }
  }
  
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

// Get doctor holidays/unavailable dates
export const getDoctorHolidays = async (req, res) => {
  const userId = req.user.id;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  res.status(StatusCodes.OK).json({ holidays: doctor.holidays || [] });
};

// Set doctor holidays/unavailable dates
export const setDoctorHolidays = async (req, res) => {
  const userId = req.user.id;
  const { holidays } = req.body;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  
  // Validate holidays format
  if (!Array.isArray(holidays)) {
    throw new BadRequestError("Holidays must be an array");
  }
  
  // Validate each holiday entry
  for (const holiday of holidays) {
    if (!holiday.date || !holiday.reason) {
      throw new BadRequestError("Each holiday must have date and reason");
    }
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday.date)) {
      throw new BadRequestError("Date must be in YYYY-MM-DD format");
    }
  }
  
  doctor.holidays = holidays;
  doctor.updatedAt = new Date();
  await doctor.save();
  res.status(StatusCodes.OK).json({ message: "Holidays updated", holidays: doctor.holidays });
};

// Get public doctor availability (for patients) - includes slots and holidays
export const getPublicDoctorAvailability = async (req, res) => {
  const { doctorId } = req.params;
  const doctor = await Doctor.findById(doctorId).select('availableSlots holidays name specialties');
  if (!doctor) throw new BadRequestError("Doctor not found");
  
  // Filter out already booked slots and past dates
  const today = new Date().toISOString().split('T')[0];
  const availableSlots = doctor.availableSlots
    .filter(daySlots => daySlots.date >= today)
    .map(daySlots => ({
      date: daySlots.date,
      slots: daySlots.slots.filter(slot => !slot.isBooked)
    }))
    .filter(daySlots => daySlots.slots.length > 0);
  
  // Filter out past holidays
  const upcomingHolidays = doctor.holidays
    ? doctor.holidays.filter(holiday => holiday.date >= today)
    : [];
  
  res.status(StatusCodes.OK).json({
    doctor: {
      id: doctor._id,
      name: doctor.name,
      specialties: doctor.specialties
    },
    availableSlots,
    holidays: upcomingHolidays
  });
};

// Generate recurring weekly slots for doctors
export const generateRecurringSlots = async (req, res) => {
  const userId = req.user.id;
  const { weeklyPattern, startDate, endDate } = req.body;
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) throw new BadRequestError("Doctor profile not found");
  
  // Validate input
  if (!weeklyPattern || !startDate || !endDate) {
    throw new BadRequestError("Weekly pattern, start date, and end date are required");
  }
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new BadRequestError("Dates must be in YYYY-MM-DD format");
  }
  
  const generatedSlots = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Generate slots for each day in the range
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if this day has a pattern defined
    const dayPattern = weeklyPattern.find(pattern => pattern.dayOfWeek === dayOfWeek);
    if (dayPattern && dayPattern.slots && dayPattern.slots.length > 0) {
      // Check if this date is not a holiday
      const isHoliday = doctor.holidays && doctor.holidays.some(holiday => holiday.date === dateStr);
      if (!isHoliday) {
        generatedSlots.push({
          date: dateStr,
          slots: dayPattern.slots.map(slot => ({
            start: slot.start,
            end: slot.end,
            isBooked: false
          }))
        });
      }
    }
  }
  
  // Merge with existing slots (replace dates that already exist)
  const existingSlots = doctor.availableSlots || [];
  const existingDates = new Set(existingSlots.map(slot => slot.date));
  
  // Remove existing slots for dates in the generated range
  const filteredExistingSlots = existingSlots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slotDate < start || slotDate > end;
  });
  
  // Add generated slots
  const updatedSlots = [...filteredExistingSlots, ...generatedSlots];
  
  // Sort by date
  updatedSlots.sort((a, b) => a.date.localeCompare(b.date));
  
  doctor.availableSlots = updatedSlots;
  doctor.updatedAt = new Date();
  await doctor.save();
  
  res.status(StatusCodes.OK).json({ 
    message: "Recurring slots generated successfully", 
    generatedSlots: generatedSlots.length,
    availableSlots: doctor.availableSlots 
  });
};
