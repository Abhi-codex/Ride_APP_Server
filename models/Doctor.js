import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String },
  email: { type: String },
  phone: { type: String }, // Used for login/OTP, not editable in profile
  specialties: [{ type: String, required: true }], // e.g., ["cardiology", "pediatrics"]
  bio: { type: String },
  qualifications: { type: String },
  experience: { type: String },
  clinicAddress: { type: String },
  availableSlots: [
    {
      date: { type: String, required: true }, // ISO date string (YYYY-MM-DD)
      slots: [
        {
          start: { type: String, required: true }, // e.g., "14:00"
          end: { type: String, required: true },   // e.g., "14:30"
          isBooked: { type: Boolean, default: false },
          appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" }
        }
      ]
    }
  ],
  holidays: [
    {
      date: { type: String, required: true }, // ISO date string (YYYY-MM-DD)
      reason: { type: String, required: true }, // e.g., "Vacation", "Conference", "Personal"
      isRecurring: { type: Boolean, default: false } // for annual holidays
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Doctor", DoctorSchema);
