import mongoose from 'mongoose'

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    state: { type: String, default: 'CA', trim: true, maxlength: 2 },
    latitude: { type: Number },
    longitude: { type: Number },
    order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'locations' },
)

export const Location = mongoose.model('Location', locationSchema)
