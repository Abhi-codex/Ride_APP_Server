import mongoose from "mongoose";

const HospitalStaffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: { 
    type: String, 
    required: true, 
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
  },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  role: { 
    type: String, 
    enum: ["admin", "manager", "coordinator", "staff"], 
    default: "staff" 
  },
  department: { 
    type: String, 
    enum: ["emergency", "administration", "operations", "logistics"], 
    default: "emergency" 
  },
  // Security fields
  hashedPassword: { 
    type: String, 
    required: true,
    select: false // Don't include in regular queries
  },
  loginAttempts: { 
    type: Number, 
    default: 0,
    select: false
  },
  lastFailedLogin: { 
    type: Date, 
    default: null,
    select: false
  },
  permissions: {
    viewDashboard: { type: Boolean, default: true },
    manageDrivers: { type: Boolean, default: false },
    viewRides: { type: Boolean, default: true },
    manageHospitalInfo: { type: Boolean, default: false },
    viewAnalytics: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster queries
HospitalStaffSchema.index({ hospitalId: 1, isActive: 1 });
HospitalStaffSchema.index({ email: 1 });
HospitalStaffSchema.index({ 'hospitalId': 1, 'role': 1 });

// Update the updatedAt field before saving
HospitalStaffSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if account is locked
HospitalStaffSchema.methods.isLocked = function() {
  const lockoutTime = 15 * 60 * 1000; // 15 minutes
  return this.loginAttempts >= 5 && 
         this.lastFailedLogin && 
         (Date.now() - this.lastFailedLogin.getTime()) < lockoutTime;
};

// Method to increment login attempts
HospitalStaffSchema.methods.incLoginAttempts = function() {
  // If we have a previous failed attempt and it's outside the lockout window
  if (this.lastFailedLogin && (Date.now() - this.lastFailedLogin.getTime()) > 15 * 60 * 1000) {
    return this.updateOne({
      loginAttempts: 1,
      lastFailedLogin: new Date()
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 }, lastFailedLogin: new Date() };
  
  // Lock account after 5 attempts
  if (this.loginAttempts + 1 >= 5) {
    updates.lastFailedLogin = new Date();
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
HospitalStaffSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lastFailedLogin: 1 }
  });
};

export default mongoose.model("HospitalStaff", HospitalStaffSchema);
