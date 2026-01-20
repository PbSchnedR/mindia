import { dbGet } from '@/lib/mockDb';
import { api } from '@/lib/api';
import type { Patient, Therapist } from '@/lib/types';

// Convertir les données API en format local
function normalizeTherapist(therapist: any): Therapist {
  // Le nouveau modèle utilise "username" au lieu de firstName/lastName
  let firstName = therapist.firstName;
  let lastName = therapist.lastName;
  
  if (!firstName && !lastName && therapist.username) {
    const parts = therapist.username.split(' ');
    firstName = parts[0] || therapist.username;
    lastName = parts.slice(1).join(' ') || '';
  }
  
  return {
    id: therapist._id || therapist.id,
    firstName: firstName || '',
    lastName: lastName || '',
    email: therapist.email,
    city: therapist.city,
    profession: therapist.profession,
    password: '', // Ne jamais exposer le mot de passe
    bookingUrl: therapist.bookingUrl,
  };
}

function normalizePatient(patient: any): Patient {
  // Le nouveau modèle utilise "username" au lieu de firstName/lastName
  // On dérive firstName et lastName à partir de username si nécessaire
  let firstName = patient.firstName;
  let lastName = patient.lastName;
  
  if (!firstName && !lastName && patient.username) {
    const parts = patient.username.split(' ');
    firstName = parts[0] || patient.username;
    lastName = parts.slice(1).join(' ') || '';
  }
  
  return {
    id: patient._id || patient.id,
    therapistId: patient.therapistId?._id || patient.therapistId,
    firstName: firstName || '',
    lastName: lastName || '',
    email: patient.email,
    birthYear: patient.birthYear,
    profession: patient.profession,
    familySituation: patient.familySituation,
    therapyTopic: patient.therapyTopic,
    sessionsDone: patient.sessionsDone,
    lastSessionAt: patient.lastSessionAt,
    nextSessionAt: patient.nextSessionAt,
    bookingUrl: patient.bookingUrl,
    score: patient.score,
    magicToken: patient.magicToken,
  };
}

export async function getTherapistById(therapistId: string): Promise<Therapist | null> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { therapist } = await api.therapist.getById(therapistId);
      return normalizeTherapist(therapist);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  return db.therapists.find((t) => t.id === therapistId) ?? null;
}

export async function listPatientsForTherapist(therapistId: string): Promise<Patient[]> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { patients } = await api.therapist.getPatients();
      return patients.map(normalizePatient);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  return db.patients
    .filter((p) => p.therapistId === therapistId)
    .sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));
}

export async function getPatientById(patientId: string): Promise<Patient | null> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { patient } = await api.patient.getById(patientId);
      return normalizePatient(patient);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  return db.patients.find((p) => p.id === patientId) ?? null;
}

