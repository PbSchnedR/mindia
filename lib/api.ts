import { Platform } from 'react-native';
import type { ChatSession, Patient, Session, Therapist } from '@/lib/types';
import { storageGetJson, storageSetJson, storageRemove } from '@/lib/storage';

// Configuration de l'API
const getBaseUrl = () => {
  // En développement sur Android emulator, localhost pointe vers l'émulateur
  // Il faut utiliser 10.0.2.2 pour accéder à la machine host
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  // Pour iOS simulator et web
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getBaseUrl();
const TOKEN_KEY = 'mindia:v1:token';

// Flag pour savoir si le backend est disponible
let backendAvailable: boolean | null = null;

// Vérifier si le backend est disponible
async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    backendAvailable = response.ok;
    return backendAvailable;
  } catch {
    backendAvailable = false;
    return false;
  }
}

// Obtenir le token stocké
async function getToken(): Promise<string | null> {
  return storageGetJson<string>(TOKEN_KEY);
}

// Sauvegarder le token
async function setToken(token: string): Promise<void> {
  await storageSetJson(TOKEN_KEY, token);
}

// Supprimer le token
async function removeToken(): Promise<void> {
  await storageRemove(TOKEN_KEY);
}

// Messages d'erreur selon le code HTTP
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: 'Données invalides',
  401: 'Non autorisé',
  403: 'Accès interdit',
  404: 'Ressource introuvable',
  409: 'Ressource déjà existante',
  500: 'Erreur serveur',
};

// Fonction utilitaire pour les requêtes API
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    // Utiliser le message d'erreur du backend s'il existe, sinon utiliser un message par défaut
    const errorMessage = data.error || HTTP_ERROR_MESSAGES[response.status] || 'Erreur serveur';
    const error = new Error(errorMessage) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  
  return data;
}

// === API ===

export const api = {
  // Vérifier la disponibilité du backend
  isAvailable: async (): Promise<boolean> => {
    if (backendAvailable === null) {
      return checkBackendHealth();
    }
    return backendAvailable;
  },
  
  // Forcer une nouvelle vérification
  recheckBackend: async (): Promise<boolean> => {
    backendAvailable = null;
    return checkBackendHealth();
  },

  auth: {
    // Inscription
    register: async (data: {
      username: string;
      email: string;
      password?: string;
      role: 'therapist' | 'patient';
    }): Promise<{ user: any; token: string }> => {
      const response = await apiRequest<{ user: any; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await setToken(response.token);
      return response;
    },
    
    // Connexion (email + password optionnel)
    login: async (email: string, password?: string): Promise<{ session: Session; token: string; user: any }> => {
      const data = await apiRequest<{ session: Session; token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setToken(data.token);
      return data;
    },
    
    // Connexion thérapeute (alias)
    loginTherapist: async (email: string, password: string): Promise<{ session: Session; token: string }> => {
      const data = await api.auth.login(email, password);
      return { session: data.session, token: data.token };
    },
    
    // Connexion patient via email (sans mot de passe)
    loginPatientByMagicToken: async (email: string): Promise<{ session: Session; token: string }> => {
      const data = await api.auth.login(email);
      return { session: data.session, token: data.token };
    },
    
    // Déconnexion
    logout: async (): Promise<void> => {
      await removeToken();
    },
    
    // Obtenir le profil
    getProfile: async (): Promise<{ user: any }> => {
      return apiRequest('/auth/profile');
    },
  },

  users: {
    // Liste tous les utilisateurs
    getAll: async (): Promise<{ users: any[] }> => {
      return apiRequest('/users');
    },
    
    // Obtenir un utilisateur par ID
    getById: async (id: string): Promise<{ user: any }> => {
      return apiRequest(`/users/${id}`);
    },
    
    // Mettre à jour un utilisateur
    update: async (id: string, data: { username?: string; email?: string; password?: string }): Promise<{ user: any }> => {
      return apiRequest(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    
    // Supprimer un utilisateur
    delete: async (id: string): Promise<void> => {
      return apiRequest(`/users/${id}`, { method: 'DELETE' });
    },
    
    // Liste des patients d'un thérapeute
    getPatients: async (therapistId: string): Promise<{ patients: any[] }> => {
      return apiRequest(`/users/${therapistId}/patients`);
    },
    
    // Ajouter un patient existant à un thérapeute
    addPatient: async (therapistId: string, patientId: string): Promise<{ patients: string[] }> => {
      return apiRequest(`/users/${therapistId}/patients`, {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      });
    },
    
    // Créer un nouveau patient et l'ajouter au thérapeute (pas de mot de passe, connexion par email)
    createPatient: async (therapistId: string, data: { username: string; email: string }): Promise<{ patient: any }> => {
      return apiRequest(`/users/${therapistId}/patients/create`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    
    // Retirer un patient d'un thérapeute
    removePatient: async (therapistId: string, patientId: string): Promise<void> => {
      return apiRequest(`/users/${therapistId}/patients/${patientId}`, { method: 'DELETE' });
    },
  },

  messages: {
    // Récupérer les messages d'un utilisateur
    get: async (userId: string): Promise<{ messages: any[] }> => {
      return apiRequest(`/users/${userId}/messages`);
    },
    
    // Ajouter un message
    add: async (userId: string, from: 'therapist' | 'patient' | 'ai', text: string): Promise<{ message: any; messages: any[] }> => {
      return apiRequest(`/users/${userId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ from, text }),
      });
    },
    
    // Supprimer un message
    delete: async (userId: string, messageId: string): Promise<void> => {
      return apiRequest(`/users/${userId}/messages/${messageId}`, { method: 'DELETE' });
    },
  },

  reports: {
    // Récupérer les constats d'un patient
    get: async (patientId: string): Promise<{ reports: any[] }> => {
      return apiRequest(`/users/${patientId}/reports`);
    },
    
    // Ajouter un constat
    add: async (patientId: string, content: string, from: 'therapist' | 'ai'): Promise<{ report: any; reports: any[] }> => {
      return apiRequest(`/users/${patientId}/reports`, {
        method: 'POST',
        body: JSON.stringify({ content, from }),
      });
    },
    
    // Supprimer un constat
    delete: async (patientId: string, reportId: string): Promise<void> => {
      return apiRequest(`/users/${patientId}/reports/${reportId}`, { method: 'DELETE' });
    },
  },

  // Legacy - pour compatibilité avec le code existant
  therapist: {
    getProfile: async (): Promise<{ therapist: Therapist }> => {
      const { user } = await api.auth.getProfile();
      return { therapist: user };
    },
    getById: async (therapistId: string): Promise<{ therapist: Therapist }> => {
      const { user } = await api.users.getById(therapistId);
      return { therapist: user };
    },
    getPatients: async (): Promise<{ patients: Patient[] }> => {
      const token = await getToken();
      if (!token) throw new Error('Non connecté');
      const { patients } = await api.users.getPatients(token);
      return { patients };
    },
  },

  patient: {
    getProfile: async (): Promise<{ patient: Patient }> => {
      const { user } = await api.auth.getProfile();
      return { patient: user };
    },
    getById: async (patientId: string): Promise<{ patient: Patient }> => {
      const { user } = await api.users.getById(patientId);
      return { patient: user };
    },
  },

  chat: {
    // Récupérer les messages (maintenant liés à l'utilisateur)
    listSessionsForPatient: async (patientId: string): Promise<{ sessions: ChatSession[] }> => {
      const { messages } = await api.messages.get(patientId);
      // Convertir en format session pour compatibilité
      const session: ChatSession = {
        id: patientId,
        patientId,
        therapistId: '',
        createdAt: new Date().toISOString(),
        messages: messages.map((m: any, i: number) => ({
          id: m._id || String(i),
          author: m.from,
          text: m.text,
          createdAt: m.createdAt || new Date().toISOString(),
        })),
      };
      return { sessions: messages.length > 0 ? [session] : [] };
    },
    
    listSessionsForTherapist: async (): Promise<{ sessions: ChatSession[] }> => {
      return { sessions: [] };
    },
    
    startSession: async (): Promise<{ session: ChatSession }> => {
      const token = await getToken();
      const session: ChatSession = {
        id: token || 'new',
        patientId: token || '',
        therapistId: '',
        createdAt: new Date().toISOString(),
        messages: [],
      };
      return { session };
    },
    
    addMessage: async (sessionId: string, text: string): Promise<{ session: ChatSession }> => {
      const token = await getToken();
      if (!token) throw new Error('Non connecté');
      await api.messages.add(token, 'patient', text);
      const { sessions } = await api.chat.listSessionsForPatient(token);
      return { session: sessions[0] };
    },
    
    setSeverity: async (sessionId: string, severity: 1 | 2 | 3): Promise<{ session: ChatSession }> => {
      const { sessions } = await api.chat.listSessionsForPatient(sessionId);
      return { session: { ...sessions[0], severity } };
    },
    
    updateSummary: async (sessionId: string, summary: string, keywords: string[]): Promise<{ session: ChatSession }> => {
      const { sessions } = await api.chat.listSessionsForPatient(sessionId);
      return { session: { ...sessions[0], summary, keywords } };
    },
  },
};

export default api;
