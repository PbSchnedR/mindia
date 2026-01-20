import mongoose, { Schema, Document } from 'mongoose';

export interface IPatient extends Document {
  _id: mongoose.Types.ObjectId;
  therapistId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  birthYear?: number;
  profession?: string;
  familySituation?: string;
  therapyTopic?: string;
  sessionsDone: number;
  lastSessionAt?: Date;
  nextSessionAt?: Date;
  bookingUrl?: string;
  score?: number;
  magicToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    therapistId: {
      type: Schema.Types.ObjectId,
      ref: 'Therapist',
      required: [true, 'L\'ID du thérapeute est requis'],
      index: true,
    },
    firstName: {
      type: String,
      required: [true, 'Le prénom est requis'],
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    birthYear: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
    },
    profession: {
      type: String,
      trim: true,
    },
    familySituation: {
      type: String,
      trim: true,
    },
    therapyTopic: {
      type: String,
      trim: true,
    },
    sessionsDone: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSessionAt: {
      type: Date,
    },
    nextSessionAt: {
      type: Date,
    },
    bookingUrl: {
      type: String,
      trim: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
    magicToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour recherche par thérapeute + nom
PatientSchema.index({ therapistId: 1, lastName: 1, firstName: 1 });

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
