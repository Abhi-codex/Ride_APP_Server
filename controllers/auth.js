import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import Driver from "../models/Driver.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";
import process from "process";

// Send OTP to phone number
export const sendOTP = async (req, res) => {
  try {
    const { phone, role } = req.body;

    if (!phone || !role) {
      throw new BadRequestError("Phone number and role are required");
    }

    if (!["patient", "driver", "doctor"].includes(role)) {
      throw new BadRequestError("Invalid role. Must be patient, driver, or doctor");
    }

    // Format phone number (remove any spaces, dashes, etc.)
    const formattedPhone = phone.replace(/\D/g, '');
    
    if (formattedPhone.length < 10) {
      throw new BadRequestError("Invalid phone number format");
    }

    // Check if user exists
    let user = await User.findOne({ phone: formattedPhone });
    
    if (!user) {
      // Create new user
      user = new User({
        phone: formattedPhone,
        role,
        profileCompleted: false
      });
    }

    // Check if last OTP was sent recently (prevent spam)
    if (user.lastOtpSent && (new Date() - user.lastOtpSent) < 60000) {
      throw new BadRequestError("Please wait 60 seconds before requesting another OTP");
    }

    // Generate and save OTP
    const otp = user.generateOTP();
    await user.save();

    // TODO: In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    // For now, we'll return the OTP in response (only for development)
    console.log(`📱 OTP for ${formattedPhone}: ${otp}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "OTP sent successfully",
      phone: formattedPhone,
      // Remove this in production - OTP should only be sent via SMS
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      expiresIn: "10 minutes"
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message || "Failed to send OTP"
    });
  }
};

// Verify OTP and login/register user
export const verifyOTP = async (req, res) => {
  try {
    const { phone, otp, name, email } = req.body;

    if (!phone || !otp) {
      throw new BadRequestError("Phone number and OTP are required");
    }

    const formattedPhone = phone.replace(/\D/g, '');
    
    // Find user by phone
    const user = await User.findOne({ phone: formattedPhone });
    
    if (!user) {
      throw new UnauthenticatedError("User not found. Please request OTP first.");
    }

    // Verify OTP
    const otpResult = user.verifyOTP(otp);
    
    if (!otpResult.success) {
      await user.save(); // Save updated attempt count
      throw new UnauthenticatedError(otpResult.message);
    }

    // If this is first time login and name is provided, update profile
    if (name && !user.name) {
      user.name = name;
    }
    
    if (email && !user.email) {
      user.email = email;
    }

    await user.save();

    // Create role-specific profile if it doesn't exist
    if (user.role === "doctor") {
      let doctorProfile = await Doctor.findOne({ user: user._id });
      if (!doctorProfile) {
        doctorProfile = await Doctor.create({
          user: user._id,
          name: user.name || "",
          email: user.email || "",
          phone: user.phone,
          specialties: [],
          bio: "",
          availableSlots: []
        });
      }
    } else if (user.role === "patient") {
      let patientProfile = await Patient.findOne({ user: user._id });
      if (!patientProfile) {
        patientProfile = await Patient.create({
          user: user._id
        });
      }
    } else if (user.role === "driver") {
      let driverProfile = await Driver.findOne({ user: user._id });
      if (!driverProfile) {
        driverProfile = await Driver.create({
          user: user._id,
          isOnline: false
        });
      }
    }

    // Generate JWT tokens
    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        phoneVerified: user.phoneVerified,
        profileCompleted: user.profileCompleted,
        isNewUser: !user.name // Indicates if profile needs completion
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: error.message || "OTP verification failed"
    });
  }
};

export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      throw new UnauthenticatedError("Invalid refresh token");
    }

    const newAccessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    throw new UnauthenticatedError("Invalid refresh token");
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, vehicle, hospitalAffiliation } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new BadRequestError("User not found");
    }

    // Prepare update data
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Handle vehicle information for drivers
    if (user.role === "driver" && vehicle) {
      const { type, plateNumber, model, licenseNumber, certificationLevel, specializations } = vehicle;

      // Validate ambulance type with new types
      const validTypes = ["bls", "als", "ccs", "auto", "bike"];
      if (type && !validTypes.includes(type)) {
        throw new BadRequestError(
          "Invalid ambulance type. Valid types: bls (Basic Life Support), als (Advanced Life Support), ccs (Critical Care Support), auto (Auto Ambulance), bike (Bike Safety Unit)"
        );
      }

      // Validate certification level
      const validCertifications = ["EMT-Basic", "EMT-Intermediate", "EMT-Paramedic", "Critical Care"];
      if (certificationLevel && !validCertifications.includes(certificationLevel)) {
        throw new BadRequestError(
          "Invalid certification level. Valid levels: EMT-Basic, EMT-Intermediate, EMT-Paramedic, Critical Care"
        );
      }

      // Validate specializations
      const validSpecializations = ["cardiac", "trauma", "respiratory", "neurological", "pediatric", "obstetric", "psychiatric", "burns", "poisoning", "general"];
      if (specializations && Array.isArray(specializations)) {
        const invalidSpecs = specializations.filter(spec => !validSpecializations.includes(spec));
        if (invalidSpecs.length > 0) {
          throw new BadRequestError(
            `Invalid specializations: ${invalidSpecs.join(", ")}. Valid specializations: ${validSpecializations.join(", ")}`
          );
        }
      }

      // Update vehicle information
      if (type) updateData["vehicle.type"] = type;
      if (plateNumber) updateData["vehicle.plateNumber"] = plateNumber;
      if (model) updateData["vehicle.model"] = model;
      if (licenseNumber) updateData["vehicle.licenseNumber"] = licenseNumber;
      if (certificationLevel) updateData["vehicle.certificationLevel"] = certificationLevel;
      if (specializations) updateData["vehicle.specializations"] = specializations;
    }

    // Handle hospital affiliation for drivers
    if (user.role === "driver" && hospitalAffiliation) {
      const { 
        isAffiliated, 
        hospitalName, 
        hospitalId, 
        hospitalAddress, 
        employeeId,
        customFareFormula 
      } = hospitalAffiliation;

      if (isAffiliated !== undefined) updateData["hospitalAffiliation.isAffiliated"] = isAffiliated;
      if (hospitalName) updateData["hospitalAffiliation.hospitalName"] = hospitalName;
      if (hospitalId) updateData["hospitalAffiliation.hospitalId"] = hospitalId;
      if (hospitalAddress) updateData["hospitalAffiliation.hospitalAddress"] = hospitalAddress;
      if (employeeId) updateData["hospitalAffiliation.employeeId"] = employeeId;

      // Handle custom fare formula for hospital-affiliated drivers
      if (customFareFormula) {
        const { baseFare, perKmRate, minimumFare } = customFareFormula;
        if (baseFare !== undefined) updateData["hospitalAffiliation.customFareFormula.baseFare"] = baseFare;
        if (perKmRate !== undefined) updateData["hospitalAffiliation.customFareFormula.perKmRate"] = perKmRate;
        if (minimumFare !== undefined) updateData["hospitalAffiliation.customFareFormula.minimumFare"] = minimumFare;
      }
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: "-__v" }
    );

    res.status(StatusCodes.OK).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-__v");
    if (!user) {
      throw new BadRequestError("User not found");
    }

    res.status(StatusCodes.OK).json({
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    throw error;
  }
};

// JWT authentication middleware
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: "Invalid or expired token" });
  }
};
