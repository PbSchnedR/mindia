import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { ChatSession, Patient, Session, Therapist } from '@/lib/types';
import { storageGetJson, storageSetJson, storageRemove } from '@/lib/storage';

// Configuration de l'API
const getBaseUrl = () => {
  // Priorité 1: Variable d'environnement Expo (depuis .env)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl !== 'http://localhost:3000/api') {
    console.log('[API] Utilisation de EXPO_PUBLIC_API_URL:', envUrl);
    return envUrl;
  }
  
  // Priorité 2: Configuration Expo extra
  const expoConfigUrl = Constants.expoConfig?.extra?.apiUrl;
  if (expoConfigUrl && expoConfigUrl !== 'http://localhost:3000/api') {
    console.log('[API] Utilisation de expoConfig.extra.apiUrl:', expoConfigUrl);
    return expoConfigUrl;
  }
  
  // Par défaut selon la plateforme
  if (Platform.OS === 'web') {
    // Web: toujours localhost
    return 'http://localhost:3000/api';
  }
  
  if (Platform.OS === 'android') {
    // Android émulateur: 10.0.2.2 pointe vers la machine host
    // ⚠️ Pour téléphone physique Android, vous devez définir EXPO_PUBLIC_API_URL 
    // dans .env avec votre IP locale (ex: http://192.168.1.100:3000/api)
    return 'http://10.0.2.2:3000/api';
  }
  
  // iOS: localhost fonctionne pour le simulator
  // ⚠️ Pour téléphone physique iOS, vous devez définir EXPO_PUBLIC_API_URL 
  // dans .env avec votre IP locale (ex: http://192.168.1.100:3000/api)
  return 'http://localhost:3000/api';
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || getBaseUrl();
const TOKEN_KEY = 'mindia:v1:token';

// Log de l'URL utilisée au démarrage
console.log('[API] URL de base configurée:', API_BASE_URL);
console.log('[API] Plateforme:', Platform.OS);

// Cache mémoire pour le token (pour éviter les problèmes de timing avec AsyncStorage)
let tokenCache: string | null = null;

// Flag pour savoir si le backend est disponible
let backendAvailable: boolean | null = null;
let backendCheckInProgress: Promise<boolean> | null = null;

// Vérifier si le backend est disponible (avec retry pour Render cold start)
async function checkBackendHealth(retries = 5, delayMs = 3000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout pour Render
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        backendAvailable = true;
        return true;
      }
    } catch {
      // Continue to retry
    }
    
    // Si ce n'est pas le dernier essai, attendre avant de réessayer
    if (attempt < retries) {
      console.log(`[API] Backend pas encore disponible, tentative ${attempt}/${retries}. Nouvelle tentative dans ${delayMs/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  backendAvailable = false;
  return false;
}

// Attendre que le backend soit disponible (utilisé au démarrage)
async function waitForBackend(): Promise<boolean> {
  if (backendAvailable === true) return true;
  
  // Éviter les appels multiples simultanés
  if (backendCheckInProgress) {
    return backendCheckInProgress;
  }
  
  backendCheckInProgress = checkBackendHealth();
  const result = await backendCheckInProgress;
  backendCheckInProgress = null;
  return result;
}

// Obtenir le token stocké (utilise le cache mémoire en priorité)
async function getToken(): Promise<string | null> {
  if (tokenCache) {
    return tokenCache;
  }
  // Utiliser getItem directement pour le token (pas JSON.parse)
  const stored = await storageGetJson<string>(TOKEN_KEY);
  if (stored) {
    tokenCache = stored;
  }
  return stored;
}

// Sauvegarder le token (en mémoire ET dans le storage)
async function setToken(token: string): Promise<void> {
  console.log('[API] Sauvegarde du token:', token.substring(0, 20) + '...');
  tokenCache = token; // Sauvegarder d'abord en cache mémoire (disponible immédiatement)
  await storageSetJson(TOKEN_KEY, token); // Puis dans AsyncStorage pour persistance
  console.log('[API] Token sauvegardé avec succès');
}

// Supprimer le token (de la mémoire ET du storage)
async function removeToken(): Promise<void> {
  console.log('[API] Suppression du token');
  tokenCache = null;
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
  
  console.log('[API] Requête:', endpoint, 'Token présent:', !!token, token ? `(${token.substring(0, 20)}...)` : '');
  
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
    console.error('[API] Erreur:', response.status, data.error || HTTP_ERROR_MESSAGES[response.status]);
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
  // Vérifier la disponibilité du backend (check rapide)
  isAvailable: async (): Promise<boolean> => {
    if (backendAvailable === null) {
      return checkBackendHealth(1, 0); // Un seul essai, pas de retry
    }
    return backendAvailable;
  },
  
  // Attendre que le backend soit disponible (avec retries pour cold start)
  waitForBackend: async (): Promise<boolean> => {
    return waitForBackend();
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
    
    // Connexion via token (magic token ou JWT) pour QR code ou restauration de session
    loginWithToken: async (token: string): Promise<{ session: Session; user: any }> => {
      const data = await apiRequest<{ session: Session; token: string; user: any }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      // Le backend retourne un JWT (nouveau si magic token, existant sinon)
      await setToken(data.token);
      console.log('[API] JWT stocké après vérification du token');
      return data;
    },
    
    // Vérifier si un token est valide (sans le sauvegarder)
    verifyToken: async (token: string): Promise<{ session: Session; user: any } | null> => {
      try {
        return await apiRequest<{ session: Session; user: any }>('/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
      } catch {
        return null;
      }
    },
    
    // Récupérer le token stocké
    getStoredToken: async (): Promise<string | null> => {
      return getToken();
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

  conversations: {
    // Liste des conversations d'un utilisateur
    listForUser: async (userId: string): Promise<{ conversations: any[] }> => {
      return apiRequest(`/users/${userId}/conversations`);
    },

    // Créer une nouvelle conversation (optionnellement avec un premier message)
    create: async (
      userId: string,
      initialFrom?: 'therapist' | 'patient' | 'ai',
      initialText?: string
    ): Promise<{ conversation: any }> => {
      return apiRequest(`/users/${userId}/conversations`, {
        method: 'POST',
        body: JSON.stringify(
          initialFrom && initialText
            ? { initialFrom, initialText }
            : {}
        ),
      });
    },

    // Récupérer les messages d'une conversation
    getMessages: async (
      userId: string,
      conversationId: string
    ): Promise<{ messages: any[] }> => {
      return apiRequest(
        `/users/${userId}/conversations/${conversationId}/messages`
      );
    },

    // Ajouter un message dans une conversation
    addMessage: async (
      userId: string,
      conversationId: string,
      from: 'therapist' | 'patient' | 'ai',
      text: string
    ): Promise<{ message: any; messages: any[] }> => {
      return apiRequest(
        `/users/${userId}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ from, text }),
        }
      );
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

  ai: {
    reply: async (messages: { from: 'therapist' | 'patient' | 'ai'; text: string }[]): Promise<{ reply: string }> => {
      return apiRequest('/ai/reply', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
    },
    ocr: async (params: { imageBase64: string; mimeType?: string }): Promise<{ text: string }> => {
      return apiRequest('/ai/ocr', {
        method: 'POST',
        body: JSON.stringify(params),
      });
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
      // Utilise la route protégée qui extrait l'ID du token JWT
      const { patients } = await apiRequest<{ patients: Patient[] }>('/therapist/patients');
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
    // Générer un magic token à usage unique pour le QR code (expire après 24h)
    generateMagicToken: async (patientId: string): Promise<{ magicToken: string; expiresIn: string; patient: any }> => {
      return apiRequest(`/users/${patientId}/token`);
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
          author: m.author ?? m.from,
          text: m.text ?? m.content,
          createdAt: m.createdAt || new Date().toISOString(),
        })),
      };
      return { sessions: messages.length > 0 ? [session] : [] };
    },
    
    listSessionsForTherapist: async (): Promise<{ sessions: ChatSession[] }> => {
      return { sessions: [] };
    },
    
    startSession: async (patientId: string): Promise<{ session: ChatSession }> => {
      const session: ChatSession = {
        id: patientId,
        patientId,
        therapistId: '',
        createdAt: new Date().toISOString(),
        messages: [],
      };
      return { session };
    },
    
    addMessage: async (
      patientId: string,
      author: 'therapist' | 'patient' | 'ai',
      text: string
    ): Promise<{ session: ChatSession }> => {
      await api.messages.add(patientId, author, text);
      const { sessions } = await api.chat.listSessionsForPatient(patientId);
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

  // ==================== JOURNALING ====================
  journal: {
    get: async (userId: string) => {
      const res = await apiRequest<any>(`/users/${userId}/journal`);
      return { entries: res.entries || res.data?.entries || [] };
    },
    add: async (userId: string, entry: { text: string; mood?: number; tags?: string[]; crisisLevel?: number }) => {
      const res = await apiRequest<any>(`/users/${userId}/journal`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
      return { entry: res.entry || res.data?.entry };
    },
    delete: async (userId: string, entryId: string) => {
      return apiRequest<any>(`/users/${userId}/journal/${entryId}`, { method: 'DELETE' });
    },
  },

  // ==================== CRISIS EVALUATIONS ====================
  crisisEval: {
    get: async (userId: string) => {
      const res = await apiRequest<any>(`/users/${userId}/crisis-eval`);
      return { evaluations: res.evaluations || res.data?.evaluations || [] };
    },
    add: async (userId: string, data: { level: number; summary?: string; conversationId?: string }) => {
      const res = await apiRequest<any>(`/users/${userId}/crisis-eval`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { evaluation: res.evaluation || res.data?.evaluation };
    },
  },

  // ==================== RECOMMENDED ACTIONS ====================
  actions: {
    get: async (userId: string) => {
      const res = await apiRequest<any>(`/users/${userId}/actions`);
      return { actions: res.actions || res.data?.actions || [] };
    },
    set: async (userId: string, actions: any[]) => {
      return apiRequest<any>(`/users/${userId}/actions`, {
        method: 'PUT',
        body: JSON.stringify({ actions }),
      });
    },
  },

  // ==================== DATA CONSENT ====================
  consent: {
    accept: async (userId: string, version?: string) => {
      return apiRequest<any>(`/users/${userId}/consent`, {
        method: 'POST',
        body: JSON.stringify({ version: version || '1.0' }),
      });
    },
  },
};

export default api;
