import { storageGetJson, storageSetJson } from '@/lib/storage';
import type { ChatSession, Patient, Therapist } from '@/lib/types';

const KEY = 'mindia:v1:db';

export type Db = {
  therapists: Therapist[];
  patients: Patient[];
  chatSessions: ChatSession[];
};

function seedDb(): Db {
  const therapistId = 'th_001';
  const patient1Id = 'pa_001';
  const patient2Id = 'pa_002';

  const therapist: Therapist = {
    id: therapistId,
    firstName: 'Camille',
    lastName: 'Durand',
    email: 'camille@cabinet-demo.fr',
    city: 'Lyon',
    profession: 'Psychologue',
    password: 'demo1234',
    bookingUrl: 'https://www.doctolib.fr/',
  };

  const patients: Patient[] = [
    {
      id: patient1Id,
      therapistId,
      firstName: 'Alex',
      lastName: 'Martin',
      email: 'alex@demo.fr',
      birthYear: 1998,
      profession: 'Étudiant',
      familySituation: 'Célibataire',
      therapyTopic: 'Anxiété / crises',
      sessionsDone: 4,
      lastSessionAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      nextSessionAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
      bookingUrl: therapist.bookingUrl,
      score: 62,
      magicToken: 'ALEX-2026',
    },
    {
      id: patient2Id,
      therapistId,
      firstName: 'Inès',
      lastName: 'Bernard',
      email: 'ines@demo.fr',
      birthYear: 1989,
      profession: 'Marketing',
      familySituation: 'En couple',
      therapyTopic: 'Humeur / fatigue',
      sessionsDone: 2,
      lastSessionAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 23).toISOString(),
      nextSessionAt: undefined,
      bookingUrl: therapist.bookingUrl,
      score: 48,
      magicToken: 'INES-2026',
    },
  ];

  return {
    therapists: [therapist],
    patients,
    chatSessions: [],
  };
}

export async function dbGet(): Promise<Db> {
  const existing = await storageGetJson<Db>(KEY);
  if (existing) return existing;
  const seeded = seedDb();
  await storageSetJson(KEY, seeded);
  return seeded;
}

export async function dbSet(next: Db): Promise<void> {
  await storageSetJson(KEY, next);
}

export async function dbReset(): Promise<void> {
  await storageSetJson(KEY, seedDb());
}

