import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";
import process from "process";

export const auth = async (req, res) => {
  console.log('AUTH REQUEST BODY:', req.body);
  const { phone, role, vehicle, hospitalAffiliation, isOnline } = req.body;

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  if (!role || !["patient", "driver", "doctor"].includes(role)) {
    throw new BadRequestError("Valid role is required (patient, driver, or doctor)");
  }

  try {
    let user = await User.findOne({ phone });

    if (user) {
      if (user.role !== role) {
        throw new BadRequestError("Phone number and role do not match");
      }

      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();

      return res.status(StatusCodes.OK).json({
        message: "User logged in successfully",
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    user = new User({
      phone,
      role,
    });
    await user.save();


    // Create role-specific profile
    if (role === "doctor") {
      const Doctor = (await import("../models/Doctor.js")).default;
      await Doctor.create({ user: user._id, specialties: [], bio: "", availableSlots: [] });
    } else if (role === "patient") {
      const Patient = (await import("../models/Patient.js")).default;
      await Patient.create({ user: user._id });
    } else if (role === "driver") {
      // Require vehicle.type and vehicle.plateNumber for driver registration
      if (!vehicle || !vehicle.type || !vehicle.plateNumber) {
        throw new BadRequestError("Driver registration requires vehicle.type and vehicle.plateNumber");
      }
      const Driver = (await import("../models/Driver.js")).default;
      await Driver.create({
        user: user._id,
        vehicle,
        hospitalAffiliation: hospitalAffiliation || undefined,
        isOnline: isOnline || false
      });
    }

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.CREATED).json({
      message: "User created successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error('AUTH ERROR:', error);
    throw error;
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
