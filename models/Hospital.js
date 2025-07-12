import mongoose from 'mongoose';

const { Schema } = mongoose;

const hospitalSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },
    emergencyServices: [{
      type: String,
      enum: [
        'emergency_room',
        'cardiology', 
        'trauma_center',
        'neurology',
        'pediatrics',
        'obstetrics',
        'burn_unit',
        'psychiatry',
        'intensive_care',
        'surgery',
        'blood_bank'
      ],
    }],
    placeId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    operatingHours: {
      type: String,
      default: "24/7", // Most hospitals operate 24/7 for emergencies
    },
    totalBeds: {
      type: Number,
      default: null,
    },
    availableBeds: {
      type: Number,
      default: null,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for location-based queries
hospitalSchema.index({ "location.latitude": 1, "location.longitude": 1 });

// Index for emergency services
hospitalSchema.index({ emergencyServices: 1 });

const Hospital = mongoose.model("Hospital", hospitalSchema);
export default Hospital;
