import HospitalStaff from "../models/HospitalStaff.js";
import Hospital from "../models/Hospital.js";
import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Helper functions are kept as they were in your file
const loginAttempts = new Map();
const cleanExpiredAttempts = () => {};
const isRateLimited = (ip) => false;
const recordFailedAttempt = (ip) => {};
const clearFailedAttempts = (ip) => {};

// --- AUTHENTICATION & STAFF MANAGEMENT (FROM YOUR ORIGINAL FILE) ---

export const hospitalStaffLogin = async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  try {
    if (isRateLimited(clientIP)) { return res.status(StatusCodes.TOO_MANY_REQUESTS).json({ success: false, error: "Too many failed login attempts. Please try again in 15 minutes." }); }
    const { email, password } = req.body;
    if (!email || !password) { throw new BadRequestError("Please provide email and password"); }
    const staffMember = await HospitalStaff.findOne({ email: email.toLowerCase().trim(), isActive: true }).populate('hospitalId', 'name address location').select('+hashedPassword +loginAttempts +lastFailedLogin');
    if (!staffMember) { recordFailedAttempt(clientIP); throw new UnauthenticatedError("Invalid credentials"); }
    if (staffMember.loginAttempts >= 5) {
      const lockoutTime = 15 * 60 * 1000;
      const timeSinceLastFailed = Date.now() - new Date(staffMember.lastFailedLogin).getTime();
      if (timeSinceLastFailed < lockoutTime) { recordFailedAttempt(clientIP); throw new UnauthenticatedError("Account temporarily locked due to too many failed attempts"); }
      else { staffMember.loginAttempts = 0; staffMember.lastFailedLogin = null; }
    }
    const isValidPassword = await bcrypt.compare(password, staffMember.hashedPassword);
    if (!isValidPassword) {
      staffMember.loginAttempts = (staffMember.loginAttempts || 0) + 1;
      staffMember.lastFailedLogin = new Date();
      await staffMember.save();
      recordFailedAttempt(clientIP);
      throw new UnauthenticatedError("Invalid credentials");
    }
    staffMember.loginAttempts = 0; staffMember.lastFailedLogin = null; staffMember.lastLogin = new Date();
    await staffMember.save();
    clearFailedAttempts(clientIP);
    const token = jwt.sign({ id: staffMember._id, email: staffMember.email, role: staffMember.role, hospitalId: staffMember.hospitalId._id, type: 'hospital-staff' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(StatusCodes.OK).json({ success: true, staff: { id: staffMember._id, name: staffMember.name, email: staffMember.email, role: staffMember.role, department: staffMember.department, permissions: staffMember.permissions, hospital: staffMember.hospitalId }, token });
  } catch (error) {
    console.error(`Hospital login error for IP ${clientIP}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

export const createHospitalStaff = async (req, res) => {
  try {
    const { name, email, password, phone, hospitalId, role, department, permissions } = req.body;
    if (await HospitalStaff.findOne({ email: email.toLowerCase().trim() })) { throw new BadRequestError("Email already registered"); }
    if (await User.findOne({ email: email.toLowerCase().trim() })) { throw new BadRequestError("Email already registered in the system"); }
    if (!await Hospital.findById(hospitalId)) { throw new BadRequestError("Invalid hospital ID"); }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password: hashedPassword, phone: phone.trim(), role: 'hospital_staff' });
    const staffMember = await HospitalStaff.create({ user: user._id, name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), hospitalId, role: role || 'staff', department: department || 'emergency', hashedPassword, permissions: permissions || { viewDashboard: true, manageDrivers: false, viewRides: true, manageHospitalInfo: false, viewAnalytics: true }, isActive: true });
    const populatedStaff = await HospitalStaff.findById(staffMember._id).populate('hospitalId', 'name address').select('-hashedPassword -loginAttempts');
    res.status(StatusCodes.CREATED).json({ success: true, message: "Hospital staff created successfully", staff: populatedStaff });
  } catch (error) {
    console.error('Create staff error:', error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

export const debugAuth = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({ user: req.user, staffFound: !!req.user.staffMember, staffMember: req.user.staffMember });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// --- DASHBOARD DATA FUNCTIONS (CORRECTED) ---

export const getHospitalDashboard = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const cacheKey = `dashboard-${hospitalId}`;
    const cached = cache.get(cacheKey);
    if (cached) { return res.status(StatusCodes.OK).json({ success: true, cached: true, ...cached }); }
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    const [activeRides, affiliatedDrivers, todayCompletedRides, emergencyStats, onlineDriversCount] = await Promise.all([
      Ride.find({ 'destinationHospital.hospitalId': hospitalId, status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] } }).limit(20),
      Driver.find({ 'hospitalAffiliation.hospitalId': hospitalId.toString(), 'hospitalAffiliation.isAffiliated': true }).limit(50),
      Ride.countDocuments({ 'destinationHospital.hospitalId': hospitalId, status: "COMPLETED", createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Ride.aggregate([{ $match: { 'destinationHospital.hospitalId': hospitalId, createdAt: { $gte: startOfDay, $lte: endOfDay } } }, { $group: { _id: '$emergency.type', count: { $sum: 1 }, criticalCount: { $sum: { $cond: [{ $eq: ['$emergency.priority', 'critical'] }, 1, 0] } } } }]),
      Driver.countDocuments({ 'hospitalAffiliation.hospitalId': hospitalId.toString(), 'hospitalAffiliation.isAffiliated': true, isOnline: true })
    ]);
    const dashboardData = { hospital: req.user.staffMember.hospitalId, statistics: { activeRides: activeRides.length, todayCompletedRides, affiliatedDrivers: affiliatedDrivers.length, onlineDrivers: onlineDriversCount }, emergencyStats, recentRides: activeRides.slice(0, 10), drivers: affiliatedDrivers.slice(0, 20), lastUpdated: new Date() };
    cache.set(cacheKey, dashboardData, 120);
    res.status(StatusCodes.OK).json({ success: true, cached: false, ...dashboardData });
  } catch (error) {
    console.error(`Dashboard error for hospital ${req.user.hospitalId}:`, error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to load dashboard data. Please try again." });
  }
};

export const getHospitalRides = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const { page = 1, limit = 20, status, priority, emergencyType } = req.query;
    const filter = { 'destinationHospital.hospitalId': hospitalId };
    if (status) filter.status = status;
    if (priority) filter['emergency.priority'] = priority;
    if (emergencyType) filter['emergency.type'] = emergencyType;
    const rides = await Ride.find(filter).populate('customer', 'name phone').populate('rider', 'name phone').sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const total = await Ride.countDocuments(filter);
    res.status(StatusCodes.OK).json({ rides, totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

export const getHospitalDrivers = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const drivers = await Driver.find({ 'hospitalAffiliation.hospitalId': hospitalId.toString(), 'hospitalAffiliation.isAffiliated': true }).populate('user', 'name phone email').sort({ createdAt: -1 });
    const driversWithRides = await Promise.all(drivers.map(async (driver) => {
      const currentRide = await Ride.findOne({ rider: driver.user._id, status: { $in: ["START", "ARRIVED"] } }).populate('customer', 'name phone');
      return { ...driver.toObject(), currentRide };
    }));
    res.status(StatusCodes.OK).json({ drivers: driversWithRides });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

export const getHospitalAnalytics = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const { days = 7 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const dailyStats = await Ride.aggregate([{ $match: { 'destinationHospital.hospitalId': hospitalId, createdAt: { $gte: startDate, $lte: endDate } } }, { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } }, totalRides: { $sum: 1 }, completedRides: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }, criticalEmergencies: { $sum: { $cond: [{ $eq: ['$emergency.priority', 'critical'] }, 1, 0] } }, averageRating: { $avg: '$rating' } } }, { $sort: { '_id.date': 1 } }]);
    const emergencyDistribution = await Ride.aggregate([{ $match: { 'destinationHospital.hospitalId': hospitalId, createdAt: { $gte: startDate, $lte: endDate } } }, { $group: { _id: '$emergency.type', count: { $sum: 1 }, avgPriority: { $avg: { $cond: [{ $eq: ['$emergency.priority', 'critical'] }, 4, { $cond: [{ $eq: ['$emergency.priority', 'high'] }, 3, { $cond: [{ $eq: ['$emergency.priority', 'medium'] }, 2, 1] }] }] }} } }]);
    res.status(StatusCodes.OK).json({ dailyStats, emergencyDistribution, totalDays: parseInt(days) });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

export const updateHospitalInfo = async (req, res) => {
  try {
    if (!req.user.permissions.manageHospitalInfo) { throw new UnauthenticatedError("Access denied"); }
    const hospitalId = req.user.staffMember.hospitalId._id;
    const { totalBeds, availableBeds, operatingHours } = req.body;
    const updatedHospital = await Hospital.findByIdAndUpdate(hospitalId, { ...(totalBeds && { totalBeds }), ...(availableBeds && { availableBeds }), ...(operatingHours && { operatingHours }), lastUpdated: new Date() }, { new: true });
    res.status(StatusCodes.OK).json({ hospital: updatedHospital });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// In controllers/hospitalDashboard.js

// in controllers/hospitalDashboard.js

export const getIncomingPatients = async (req, res) => {
  try {
    const hospitalName = req.user.staffMember.hospitalId.name;
    const hospitalNameRegex = new RegExp(hospitalName, 'i');

    // =================================================================
    // TODO: Temporary name search. Change back to ID search later.
    // =================================================================
    const incomingRides = await Ride.find({
      'drop.address': hospitalNameRegex,
      status: { $nin: ["COMPLETED", "CANCELLED"] }
    }).populate('customer', 'name phone').populate({ 
        path: 'rider', 
        populate: { 
            path: 'user', 
            model: 'User',
            select: 'name phone' 
        } 
    }).sort({ createdAt: -1 }).limit(50);

    if (!incomingRides || incomingRides.length === 0) {
      return res.status(StatusCodes.OK).json({ success: true, count: 0, patients: [] });
    }

    const formattedPatients = incomingRides.map(ride => {
      const timeToArrival = ride.destinationHospital?.estimatedArrival ? Math.max(0, Math.floor((new Date(ride.destinationHospital.estimatedArrival) - new Date()) / 60000)) : 30;
      return {
        rideId: ride._id,
        patient: { name: ride.customer?.name || "N/A", phone: ride.customer?.phone || "N/A" },
        contactInfo: { relative: ride.contactInfo?.patientRelative, specialInstructions: ride.contactInfo?.specialInstructions },
        condition: { priority: ride.emergency?.priority, description: ride.emergency?.name },
        timeToArrival,
        distance: ride.distance,
        ambulanceId: `AMB-${ride._id.toString().slice(-6).toUpperCase()}`,
        ambulance: {
          driver: ride.rider?.user ? { name: ride.rider.user.name, phone: ride.rider.user.phone } : null,
          currentLocation: ride.liveTracking?.currentLocation,
          type: ride.vehicle,
          plateNumber: ride.rider?.vehicle?.plateNumber
        },
        createdAt: ride.createdAt,
        status: ride.status,
        pickup: ride.pickup // This sends the whole pickup object, including coordinates
      };
    });
    res.status(StatusCodes.OK).json({ success: true, count: formattedPatients.length, patients: formattedPatients });
  } catch (error) {
    console.error(`Incoming patients error:`, error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to load incoming patients." });
  }
};

export const getLiveAmbulanceTracking = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const allActiveRides = await Ride.find({ status: { $in: ["START", "ARRIVED"] }, $or: [{ 'destinationHospital.hospitalId': hospitalId }, { 'liveTracking.currentLocation': { $exists: true } }] }).populate('rider', 'name phone').populate('customer', 'name phone').select('_id vehicle status liveTracking destinationHospital rider customer pickup drop emergency');
    const affiliatedDrivers = await Driver.find({ 'hospitalAffiliation.hospitalId': hospitalId.toString(), 'hospitalAffiliation.isAffiliated': true, isOnline: true }).populate('user', 'name phone');
    const ambulanceLocations = allActiveRides.map(ride => ({ id: ride._id, ambulanceId: ride._id.toString().slice(-6).toUpperCase(), type: ride.vehicle, status: ride.status, isComingToThisHospital: ride.destinationHospital?.hospitalId?.toString() === hospitalId.toString(), currentLocation: ride.liveTracking?.currentLocation || ride.pickup, driver: ride.rider ? { id: ride.rider._id, name: ride.rider.name, phone: ride.rider.phone } : null, patient: { name: ride.customer?.name || "Emergency Patient", condition: ride.emergency?.type || 'general', priority: ride.emergency?.priority || 'medium' }, lastUpdated: ride.liveTracking?.lastUpdated || ride.updatedAt }));
    const driverLocations = affiliatedDrivers.filter(driver => !ambulanceLocations.find(amb => amb.driver?.id?.toString() === driver.user._id.toString())).map(driver => ({ id: `driver_${driver._id}`, ambulanceId: `FREE-${driver._id.toString().slice(-4).toUpperCase()}`, type: driver.vehicle?.type || 'unknown', status: 'AVAILABLE', isComingToThisHospital: false, currentLocation: null, driver: { id: driver.user._id, name: driver.user.name, phone: driver.user.phone }, patient: null, lastUpdated: new Date() }));
    res.status(StatusCodes.OK).json({ success: true, totalAmbulances: ambulanceLocations.length + driverLocations.length, comingToHospital: ambulanceLocations.filter(amb => amb.isComingToThisHospital).length, ambulances: [...ambulanceLocations, ...driverLocations] });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

export const getAmbulanceStatus = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const affiliatedDrivers = await Driver.find({ 'hospitalAffiliation.hospitalId': hospitalId.toString(), 'hospitalAffiliation.isAffiliated': true }).populate('user', 'name phone');
    const activeRides = await Ride.find({ rider: { $in: affiliatedDrivers.map(d => d.user._id) }, status: { $in: ["START", "ARRIVED"] } }).populate('customer', 'name');
    const statusOverview = affiliatedDrivers.map(driver => {
      const currentRide = activeRides.find(ride => ride.rider.toString() === driver.user._id.toString());
      return { driverId: driver._id, ambulanceId: driver._id.toString().slice(-4).toUpperCase(), driver: { name: driver.user.name, phone: driver.user.phone }, vehicle: { type: driver.vehicle?.type || 'unknown', plateNumber: driver.vehicle?.plateNumber || 'N/A' }, status: driver.isOnline ? (currentRide ? 'OCCUPIED' : 'FREE') : 'OFFLINE', isOnline: driver.isOnline, currentRide: currentRide ? { id: currentRide._id, patient: currentRide.customer?.name || 'Emergency Patient', status: currentRide.status, emergency: currentRide.emergency?.type || 'general' } : null, lastSeen: driver.updatedAt };
    });
    const summary = { total: affiliatedDrivers.length, online: statusOverview.filter(s => s.isOnline).length, free: statusOverview.filter(s => s.status === 'FREE').length, occupied: statusOverview.filter(s => s.status === 'OCCUPIED').length, offline: statusOverview.filter(s => s.status === 'OFFLINE').length };
    res.status(StatusCodes.OK).json({ success: true, summary, ambulances: statusOverview });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

export const getEmergencyContacts = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const { rideId } = req.params;
    if (rideId) {
      const ride = await Ride.findById(rideId).populate('customer', 'name phone').populate('rider', 'name phone');
      if (!ride || ride.destinationHospital?.hospitalId?.toString() !== hospitalId.toString()) { return res.status(StatusCodes.NOT_FOUND).json({ success: false, error: "Ride not found or not assigned to this hospital" }); }
      res.status(StatusCodes.OK).json({ success: true, contacts: { patient: { name: ride.customer?.name || "Emergency Patient", phone: ride.customer?.phone || null }, relative: ride.contactInfo?.patientRelative || null, driver: ride.rider ? { name: ride.rider.name, phone: ride.rider.phone } : null, ambulanceId: ride._id.toString().slice(-6).toUpperCase(), specialInstructions: ride.contactInfo?.specialInstructions || null } });
    } else {
      const incomingRides = await Ride.find({ 'destinationHospital.hospitalId': hospitalId, status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] } }).populate('customer', 'name phone').populate('rider', 'name phone').select('_id customer rider contactInfo emergency');
      const allContacts = incomingRides.map(ride => ({ rideId: ride._id, ambulanceId: ride._id.toString().slice(-6).toUpperCase(), patient: { name: ride.customer?.name || "Emergency Patient", phone: ride.customer?.phone || null }, relative: ride.contactInfo?.patientRelative || null, driver: ride.rider ? { name: ride.rider.name, phone: ride.rider.phone } : null, emergency: ride.emergency?.type || 'general', priority: ride.emergency?.priority || 'medium' }));
      res.status(StatusCodes.OK).json({ success: true, count: allContacts.length, contacts: allContacts });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

export const updateBedAvailability = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const { bedDetails, totalBeds, availableBeds } = req.body;
    const calculatedTotal = bedDetails.icu.total + bedDetails.general.total + bedDetails.emergency.total;
    const calculatedAvailable = bedDetails.icu.available + bedDetails.general.available + bedDetails.emergency.available;
    if (totalBeds && totalBeds !== calculatedTotal) { throw new BadRequestError("Total beds count doesn't match sum of individual bed types"); }
    if (availableBeds && availableBeds !== calculatedAvailable) { throw new BadRequestError("Available beds count doesn't match sum of available beds by type"); }
    const updateData = { 'bedDetails.icu.total': bedDetails.icu.total, 'bedDetails.icu.available': bedDetails.icu.available, 'bedDetails.general.total': bedDetails.general.total, 'bedDetails.general.available': bedDetails.general.available, 'bedDetails.emergency.total': bedDetails.emergency.total, 'bedDetails.emergency.available': bedDetails.emergency.available, totalBeds: calculatedTotal, availableBeds: calculatedAvailable, lastUpdated: new Date() };
    const updatedHospital = await Hospital.findByIdAndUpdate(hospitalId, updateData, { new: true, runValidators: true, select: 'name bedDetails totalBeds availableBeds lastUpdated' });
    if (!updatedHospital) { throw new BadRequestError("Hospital not found"); }
    cache.del(`dashboard-${hospitalId}`); cache.del(`bed-availability-${hospitalId}`);
    if (req.io) { req.io.emit('bedAvailabilityUpdate', { hospitalId, bedDetails: updatedHospital.bedDetails, totalBeds: updatedHospital.totalBeds, availableBeds: updatedHospital.availableBeds, lastUpdated: updatedHospital.lastUpdated }); }
    res.status(StatusCodes.OK).json({ success: true, message: "Bed availability updated successfully", hospital: updatedHospital });
  } catch (error) {
    console.error(`Bed update error for hospital ${req.user.hospitalId}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

export const getBedAvailability = async (req, res) => {
  try {
    const hospitalId = req.user.staffMember.hospitalId._id;
    const hospital = await Hospital.findById(hospitalId).select('name bedDetails totalBeds availableBeds lastUpdated updatedAt');
    if (!hospital) { throw new BadRequestError("Hospital not found"); }
    const bedDetails = hospital.bedDetails || { icu: { total: 0, available: 0 }, general: { total: 0, available: 0 }, emergency: { total: 0, available: 0 } };
    const response = { hospital: { id: hospital._id, name: hospital.name, bedDetails, totalBeds: hospital.totalBeds || 0, availableBeds: hospital.availableBeds || 0, lastUpdated: hospital.lastUpdated || hospital.updatedAt, occupancyRate: hospital.totalBeds > 0 ? Math.round(((hospital.totalBeds - hospital.availableBeds) / hospital.totalBeds) * 100) : 0 } };
    res.status(StatusCodes.OK).json({ success: true, ...response });
  } catch (error) {
    const hospitalIdForError = req.user ? req.user.hospitalId : 'unknown';
    console.error(`Bed availability error for hospital ${hospitalIdForError}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Failed to load bed availability. Please try again." });
  }
};

export const updateAmbulanceLocation = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { latitude, longitude, address, timestamp } = req.body;
    if (!rideId || !mongoose.Types.ObjectId.isValid(rideId)) { throw new BadRequestError("Valid ride ID is required"); }
    const ride = await Ride.findByIdAndUpdate(rideId, { 'liveTracking.currentLocation': { latitude, longitude, address: address || `${latitude}, ${longitude}` }, 'liveTracking.lastUpdated': timestamp || new Date() }, { new: true, select: '_id destinationHospital liveTracking' });
    if (!ride) { throw new BadRequestError("Ride not found"); }
    if (ride.destinationHospital?.hospitalId) {
      const hospitalId = ride.destinationHospital.hospitalId;
      cache.del([`incoming-patients-${hospitalId}`, `live-tracking-${hospitalId}`, `dashboard-${hospitalId}`]);
    }
    if (req.io && ride.destinationHospital?.hospitalId) { req.io.emit('ambulanceLocationUpdate', { rideId: ride._id, location: { latitude, longitude }, hospitalId: ride.destinationHospital.hospitalId }); }
    res.status(StatusCodes.OK).json({ success: true, message: "Location updated successfully" });
  } catch (error) {
    console.error(`Location update error for ride ${req.params.rideId}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

// In controllers/hospitalDashboard.js

export const getMyInfo = async (req, res) => {
  try {
    // The hospitalAuth middleware already found the full staff member object.
    // We just need to send it back as the response.
    if (!req.user || !req.user.staffMember) {
      throw new UnauthenticatedError("Authentication error: User information not found.");
    }
    res.status(StatusCodes.OK).json({ 
      success: true, 
      staff: req.user.staffMember 
    });
  } catch (error) {
    console.error("Error in getMyInfo:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      error: error.message 
    });
  }
};