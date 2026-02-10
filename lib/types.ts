export type UserRole = 'patient' | 'therapist';

export type Session =
  | {
      role: 'patient';
      patientId: string;
      therapistId: string;
      token: string;
    }
  | {
      role: 'therapist';
      therapistId: string;
      email: string;
    };

export type Severity = 1 | 2 | 3;

export type ChatAuthor = 'patient' | 'ai' | 'therapist';

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  text: string;
  createdAt: string; // ISO
};

export type ChatSession = {
  id: string;
  patientId: string;
  therapistId: string;
  createdAt: string; // ISO
  messages: ChatMessage[];
  severity?: Severity;
  keywords?: string[];
  summary?: string;
};

export type Patient = {
  id: string;
  therapistId: string;
  firstName: string;
  lastName: string;
  email: string;
  // Dernier état émotionnel explicite choisi par le patient (1,2,3 stocké en string côté backend)
  actualMood?: string | null;
  birthYear?: number;
  profession?: string;
  familySituation?: string;
  therapyTopic?: string;
  sessionsDone?: number;
  lastSessionAt?: string;
  nextSessionAt?: string;
  bookingUrl?: string;
  score?: number; // simple score 0-100
  magicToken: string;
};

export type Therapist = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
  profession?: string;
  password: string;
  bookingUrl?: string;
};

export type RecommendationAction = {
  id: string;
  title: string;
  description?: string;
};

