const mongoose = require('mongoose');

const dogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true
    },
    breed: {
      type: String,
      default: 'Unknown',
      trim: true
    },
    age: {
      type: Number,
      min: 0
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unknown'],
      default: 'unknown',
      lowercase: true,
      trim: true
    },
    size: {
      type: String,
      enum: ['small', 'medium', 'large', 'extra-large', 'unknown'],
      default: 'unknown',
      lowercase: true,
      trim: true
    },
    location: {
      type: String,
      default: '',
      trim: true
    },
    intakeDate: {
      type: Date,
      default: Date.now
    },
    price: {
      type: Number,
      min: 0,
      default: 0
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['available', 'pending', 'adopted'],
      default: 'available',
      lowercase: true,
      trim: true
    },
    userId: {
      type: String,
      required: [true, 'userId is required'],
      trim: true
    }
  },
  {
    collection: 'dogs',
    versionKey: false
  }
);

module.exports = mongoose.model('Dog', dogSchema);
