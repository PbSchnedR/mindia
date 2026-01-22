import { dbGet, dbSet } from '@/lib/mockDb';
import { api } from '@/lib/api';
import type { ChatMessage, ChatSession, ChatAuthor, Severity } from '@/lib/types';

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

// Convertir les sessions API en format local
function normalizeSession(session: any): ChatSession {
  return {
    id: session._id || session.id,
    patientId: session.patientId?._id || session.patientId,
    therapistId: session.therapistId?._id || session.therapistId,
    createdAt: session.createdAt,
    messages: (session.messages || []).map((m: any) => ({
      id: m._id || m.id || uid('m'),
      author: m.author ?? m.from,
      text: m.text ?? m.content,
      createdAt: m.createdAt || new Date().toISOString(),
    })),
    severity: session.severity,
    keywords: session.keywords,
    summary: session.summary,
  };
}

export async function listChatSessionsForTherapist(therapistId: string): Promise<ChatSession[]> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { sessions } = await api.chat.listSessionsForTherapist();
      return sessions.map(normalizeSession);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  return db.chatSessions
    .filter((s) => s.therapistId === therapistId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listChatSessionsForPatient(patientId: string): Promise<ChatSession[]> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { sessions } = await api.chat.listSessionsForPatient(patientId);
      return sessions.map(normalizeSession);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  return db.chatSessions
    .filter((s) => s.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function startChatSession(patientId: string, therapistId: string): Promise<ChatSession> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { session } = await api.chat.startSession(patientId);
      return normalizeSession(session);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  const session: ChatSession = {
    id: uid('cs'),
    patientId,
    therapistId,
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: uid('m'),
        author: 'ai',
        text: "Je suis là. Qu'est-ce qui se passe là, maintenant ? (tu peux répondre en quelques mots)",
        createdAt: new Date().toISOString(),
      },
    ],
  };
  db.chatSessions.push(session);
  await dbSet(db);
  return session;
}

export async function appendMessage(
  chatSessionId: string,
  author: ChatAuthor,
  text: string
): Promise<ChatSession> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message vide.');

  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { session } = await api.chat.addMessage(chatSessionId, author, trimmed);
      return normalizeSession(session);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  const session = db.chatSessions.find((s) => s.id === chatSessionId);
  if (!session) throw new Error('Conversation introuvable.');

  const msg: ChatMessage = { id: uid('m'), author, text: trimmed, createdAt: new Date().toISOString() };
  session.messages.push(msg);
  await dbSet(db);
  return session;
}

export async function setSeverity(chatSessionId: string, severity: Severity): Promise<ChatSession> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { session } = await api.chat.setSeverity(chatSessionId, severity);
      return normalizeSession(session);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  const session = db.chatSessions.find((s) => s.id === chatSessionId);
  if (!session) throw new Error('Conversation introuvable.');
  session.severity = severity;
  await dbSet(db);
  return session;
}

export async function setSummaryAndKeywords(
  chatSessionId: string,
  summary: string,
  keywords: string[]
): Promise<ChatSession> {
  // Essayer d'abord l'API backend
  try {
    if (await api.isAvailable()) {
      const { session } = await api.chat.updateSummary(chatSessionId, summary, keywords);
      return normalizeSession(session);
    }
  } catch (error) {
    console.log('API indisponible, utilisation des données mock:', error);
  }

  // Fallback sur les données mock
  const db = await dbGet();
  const session = db.chatSessions.find((s) => s.id === chatSessionId);
  if (!session) throw new Error('Conversation introuvable.');
  session.summary = summary.trim();
  session.keywords = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 8);
  await dbSet(db);
  return session;
}

export function simpleAutoSummary(messages: ChatMessage[]): { summary: string; keywords: string[] } {
  const patientText = messages
    .filter((m) => m.author === 'patient')
    .map((m) => m.text)
    .join(' ');

  const words = patientText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .filter((w) => !['avec', 'mais', 'pour', 'dans', 'plus', 'comme', 'trop', 'tout', 'cette', 'cela'].includes(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);

  const lastPatient = [...messages].reverse().find((m) => m.author === 'patient')?.text ?? '';
  const summary =
    lastPatient.length > 0
      ? `Dernier point exprimé: ${lastPatient.slice(0, 140)}${lastPatient.length > 140 ? '…' : ''}`
      : 'Aucun message patient.';

  return { summary, keywords };
}
