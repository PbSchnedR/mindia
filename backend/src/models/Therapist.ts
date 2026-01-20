import mongoose, { Schema, Document } from 'mongoose';

export interface ITherapist extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  city?: string;
  profession?: string;
  bookingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TherapistSchema = new Schema<ITherapist>(
  {
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
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: 6,
      select: false, // Ne pas renvoyer par défaut
    },
    city: {
      type: String,
      trim: true,
    },
    profession: {
      type: String,
      trim: true,
    },
    bookingUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour recherche par email
TherapistSchema.index({ email: 1 });

export const Therapist = mongoose.model<ITherapist>('Therapist', TherapistSchema);
