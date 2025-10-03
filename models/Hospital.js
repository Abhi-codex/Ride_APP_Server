// models/Hospital.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true },
    location: { latitude: { type: Number, required: true },
                longitude: { type: Number, required: true }},
   emergencyServices: [{ 
      type: String, 
      enum: ['emergency_room', 'cardiology', 'trauma_center', 'neurology', 'pediatrics', 'obstetrics',
            'burn_unit', 'psychiatry', 'intensive_care', 'surgery', 'blood_bank',
            'respiratory', 'poisoning', 'general'
  ],
}],
    placeId: { type: String, unique: true, sparse: true },
    rating: { type: Number, min: 0, max: 5, default: null },
    phoneNumber: { type: String, default: null },
    address: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    operatingHours: { type: String, default: "24/7" },
    totalBeds: { type: Number, default: null },
    availableBeds: { type: Number, default: null },
    bedDetails: {
      icu: {
        total: { type: Number, default: 0 },
        available: { type: Number, default: 0 }
      },
      general: {
        total: { type: Number, default: 0 },
        available: { type: Number, default: 0 }
      },
      emergency: {
        total: { type: Number, default: 0 },
        available: { type: Number, default: 0 }
      }
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

hospitalSchema.index({ "location.latitude": 1, "location.longitude": 1 });

hospitalSchema.index({ emergencyServices: 1 });

const Hospital = mongoose.model("Hospital", hospitalSchema);

export default Hospital;