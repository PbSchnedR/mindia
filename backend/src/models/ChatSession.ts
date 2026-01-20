import mongoose, { Schema, Document } from 'mongoose';

export type Severity = 1 | 2 | 3;
export type ChatAuthor = 'patient' | 'ai' | 'therapist';

export interface IChatMessage {
  _id: mongoose.Types.ObjectId;
  author: ChatAuthor;
  text: string;
  createdAt: Date;
}

export interface IChatSession extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  therapistId: mongoose.Types.ObjectId;
  messages: IChatMessage[];
  severity?: Severity;
  keywords?: string[];
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    author: {
      type: String,
      enum: ['patient', 'ai', 'therapist'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'L\'ID du patient est requis'],
      index: true,
    },
    therapistId: {
      type: Schema.Types.ObjectId,
      ref: 'Therapist',
      required: [true, 'L\'ID du thérapeute est requis'],
      index: true,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
    severity: {
      type: Number,
      enum: [1, 2, 3],
    },
    keywords: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index pour recherche par thérapeute + date
ChatSessionSchema.index({ therapistId: 1, createdAt: -1 });
// Index pour recherche par patient + date
ChatSessionSchema.index({ patientId: 1, createdAt: -1 });

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
