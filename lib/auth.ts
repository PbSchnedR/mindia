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

export async function saveSession(session: Session): Promise<void> {
  await storageSetJson(SESSION_KEY, session);
}

// Se connecter avec un token JWT (scanné depuis QR code)
export async function signInWithToken(token: string): Promise<Session> {
  if (!token) throw new Error('Token invalide.');

  // Attendre que le backend soit disponible
  const isAvailable = await api.waitForBackend();
  if (!isAvailable) {
    throw new Error('Le serveur est temporairement indisponible. Réessayez dans quelques instants.');
  }

  try {
    const { session } = await api.auth.loginWithToken(token);
    await storageSetJson(SESSION_KEY, session);
    return session;
  } catch (error: any) {
    throw new Error(getErrorMessage(error));
  }
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

  // Attendre que le backend soit disponible (pas de fallback mock)
  const isAvailable = await api.waitForBackend();
  if (!isAvailable) {
    throw new Error('Le serveur est temporairement indisponible. Réessayez dans quelques instants.');
  }

  try {
    const { session } = await api.auth.login(token); // token = email pour les patients
    await storageSetJson(SESSION_KEY, session);
    return session;
  } catch (error: any) {
    throw new Error(getErrorMessage(error));
  }
}

export async function signInTherapist(emailRaw: string, passwordRaw: string): Promise<Session> {
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();
  
  if (!email) throw new Error('Veuillez entrer votre email.');
  if (!password) throw new Error('Veuillez entrer votre mot de passe.');

  // Attendre que le backend soit disponible (pas de fallback mock)
  const isAvailable = await api.waitForBackend();
  if (!isAvailable) {
    throw new Error('Le serveur est temporairement indisponible. Réessayez dans quelques instants.');
  }

  try {
    const { session } = await api.auth.loginTherapist(email, password);
    await storageSetJson(SESSION_KEY, session);
    return session;
  } catch (error: any) {
    throw new Error(getErrorMessage(error));
  }
}

