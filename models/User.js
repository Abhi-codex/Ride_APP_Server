import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    // Firebase integration fields
    firebaseUid: { type: String, required: true, unique: true },
    
    // User basic info
    role: { type: String, enum: ["patient", "driver", "doctor", "hospital_staff"], required: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
    
    // Phone number - required for patients and drivers, optional for doctors
    phone: { type: String, default: null },
    phoneVerified: { type: Boolean, default: false },
    
    // Progressive profile completion
    profileCompleted: { type: Boolean, default: false },
    onboardingStep: { type: String, enum: ["phone", "profile", "complete"], default: "phone" },
    
    // Contact methods for users without phone
    emergencyContact: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      relationship: { type: String, default: null }
    },
    
    // Auth method tracking
    authMethods: [{
      type: { type: String, enum: ["google", "phone", "email"] },
      identifier: { type: String },
      verified: { type: Boolean, default: false }
    }],
    
    // User status
    isOnline: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    
    // Firebase metadata sync
    firebaseMetadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Method to create JWT refresh token
userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      firebaseUid: this.firebaseUid,
      phone: this.phone,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

// Virtual to populate doctor profile if user is a doctor
userSchema.virtual("doctorProfile", {
  ref: "Doctor",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

// Method to create JWT access token
userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      firebaseUid: this.firebaseUid,
      phone: this.phone,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

// Method to check if phone is required for this role
userSchema.methods.isPhoneRequired = function () {
  return this.role === "patient" || this.role === "driver";
};

// Method to check if profile is complete
userSchema.methods.checkProfileCompletion = function () {
  const baseComplete = this.name && this.email;
  
  if (this.isPhoneRequired()) {
    return baseComplete && this.phone && this.phoneVerified;
  }
  
  // For doctors, phone is optional but need at least one verified contact
  return baseComplete && (
    (this.phone && this.phoneVerified) || 
    (this.email && this.authMethods.some(method => method.type === 'email' && method.verified)) ||
    (this.emergencyContact.name && this.emergencyContact.phone)
  );
};

// Method to get next onboarding step
userSchema.methods.getNextOnboardingStep = function () {
  if (!this.name || !this.email) {
    return 'profile';
  }
  
  if (this.isPhoneRequired() && (!this.phone || !this.phoneVerified)) {
    return 'phone';
  }
  
  return 'complete';
};

// Pre-save hook to update profile completion status
userSchema.pre('save', function(next) {
  this.profileCompleted = this.checkProfileCompletion();
  this.onboardingStep = this.profileCompleted ? 'complete' : this.getNextOnboardingStep();
  next();
});

// Create sparse index for phone to allow multiple null values
userSchema.index({ phone: 1 }, { sparse: true, unique: true });

const User = mongoose.model("User", userSchema);
export default User;
