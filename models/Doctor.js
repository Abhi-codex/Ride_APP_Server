import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  specialties: [{ type: String, required: true }], // e.g., ["cardiology", "pediatrics"]
  bio: { type: String },
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Doctor", DoctorSchema);
