import { dbGet } from '@/lib/mockDb';
import { api } from '@/lib/api';
import type { Session } from '@/lib/types';
import { storageGetJson, storageRemove, storageSetJson } from '@/lib/storage';

const SESSION_KEY = 'mindia:v1:session';

// Messages d'erreur utilisateur-friendly selon le code HTTP
const ERROR_MESSAGES: Record<number, string> = {
  400: 'Données invalides. Vérifiez les informations saisies.',
  401: 'Identifiants incorrects.',
  403: 'Accès non autorisé.',
  404: 'Ressource introuvable.',
  409: 'Cette ressource existe déjà.',
  500: 'Erreur serveur. Réessayez plus tard.',
};

// Extraire le message d'erreur approprié
function getErrorMessage(error: any): string {
  // Si c'est une erreur avec un message du backend
  if (error?.message) {
    return error.message;
  }
  // Si c'est un code de statut HTTP
  if (error?.status && ERROR_MESSAGES[error.status]) {
    return ERROR_MESSAGES[error.status];
  }
  return 'Une erreur est survenue. Réessayez.';
}

export async function getSession(): Promise<Session | null> {
  return await storageGetJson<Session>(SESSION_KEY);
}

export async function signOut(): Promise<void> {
  // Essayer d'abord l'API
  try {
    if (await api.isAvailable()) {
      await api.auth.logout();
    }
  } catch {
    // Ignorer les erreurs API lors de la déconnexion
  }
  await storageRemove(SESSION_KEY);
}

export async function signInPatientByMagicToken(tokenRaw: string): Promise<Session> {
  const token = tokenRaw.trim();
  if (!token) throw new Error('Veuillez entrer votre email.');

  // Essayer d'abord l'API backend (maintenant on utilise l'email)
  try {
    if (await api.isAvailable()) {
      const { session } = await api.auth.login(token); // token = email pour les patients
      await storageSetJson(SESSION_KEY, session);
      return session;
    }
  } catch (error: any) {
    // Si le backend a répondu avec une erreur, on la propage
    if (error?.message) {
      throw new Error(getErrorMessage(error));
    }
    console.log('API indisponible, utilisation des données mock');
  }

  // Fallback sur les données mock
  const db = await dbGet();
  const patient = db.patients.find((p) => 
    p.magicToken.toLowerCase() === token.toUpperCase() ||
    p.email?.toLowerCase() === token.toLowerCase()
  );
  if (!patient) throw new Error('Email ou code invalide. Vérifiez auprès de votre thérapeute.');

  const session: Session = {
    role: 'patient',
    patientId: patient.id,
    therapistId: patient.therapistId,
    token,
  };
  await storageSetJson(SESSION_KEY, session);
  return session;
}

export async function signInTherapist(emailRaw: string, passwordRaw: string): Promise<Session> {
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();
  
  if (!email) throw new Error('Veuillez entrer votre email.');
  if (!password) throw new Error('Veuillez entrer votre mot de passe.');

  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { session } = await api.auth.loginTherapist(email, password);
      await storageSetJson(SESSION_KEY, session);
      return session;
    }
  } catch (error: any) {
    // Si le backend a répondu avec une erreur, on la propage
    if (error?.message) {
      throw new Error(getErrorMessage(error));
    }
    console.log('API indisponible, utilisation des données mock');
  }

  // Fallback sur les données mock
  const db = await dbGet();
  const therapist = db.therapists.find((t) => t.email.toLowerCase() === email);
  if (!therapist || therapist.password !== password) {
    throw new Error('Email ou mot de passe incorrect.');
  }

  const session: Session = { role: 'therapist', therapistId: therapist.id, email: therapist.email };
  await storageSetJson(SESSION_KEY, session);
  return session;
}

