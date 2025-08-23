import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    // User basic info
    role: { type: String, enum: ["patient", "driver", "doctor", "hospital_staff"], required: true },
    name: { type: String, default: null },
    email: { type: String, unique: true, sparse: true },
    
    // Phone number and OTP verification
    phone: { type: String, required: true, unique: true },
    phoneVerified: { type: Boolean, default: false },
    
    // OTP fields
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    lastOtpSent: { type: Date, default: null },
    
    // Password for additional security (optional)
    password: { type: String, default: null },
    
    // Profile completion
    profileCompleted: { type: Boolean, default: false },
    
    // Emergency contact for users
    emergencyContact: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      relationship: { type: String, default: null }
    },
    
    // User status
    isOnline: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    
    // Last login tracking
    lastLogin: { type: Date, default: null },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

// Method to create JWT refresh token
userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
      role: this.role,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

// Method to create JWT access token
userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

// Method to hash password
userSchema.methods.hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(password, salt);
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
userSchema.methods.generateOTP = function() {
  this.otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
  this.otpAttempts = 0;
  this.lastOtpSent = new Date();
  return this.otp;
};

// Method to verify OTP
userSchema.methods.verifyOTP = function(providedOTP) {
  if (!this.otp || !this.otpExpiry) {
    return { success: false, message: 'No OTP found. Please request a new one.' };
  }
  
  if (new Date() > this.otpExpiry) {
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }
  
  if (this.otpAttempts >= 3) {
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }
  
  if (this.otp !== providedOTP) {
    this.otpAttempts += 1;
    return { success: false, message: 'Invalid OTP. Please try again.' };
  }
  
  // OTP is valid
  this.phoneVerified = true;
  this.otp = null;
  this.otpExpiry = null;
  this.otpAttempts = 0;
  this.lastLogin = new Date();
  
  return { success: true, message: 'OTP verified successfully.' };
};

// Method to check if user is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to check profile completion
userSchema.methods.checkProfileCompletion = function () {
  return this.name && this.phone && this.phoneVerified;
};

// Virtual to populate doctor profile if user is a doctor
userSchema.virtual("doctorProfile", {
  ref: "Doctor",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

// Pre-save hook to update profile completion status
userSchema.pre('save', function(next) {
  this.profileCompleted = this.checkProfileCompletion();
  next();
});

// Index for phone number
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { sparse: true, unique: true });

const User = mongoose.model("User", userSchema);
export default User;
