import { ChatSession, type IChatSession, type Severity, type ChatAuthor } from '../models/index.js';

export interface CreateChatSessionInput {
  patientId: string;
  therapistId: string;
  initialMessage?: string;
}

export interface AddMessageInput {
  author: ChatAuthor;
  text: string;
}

export class ChatService {
  /**
   * Créer une nouvelle session de chat
   */
  async createSession(input: CreateChatSessionInput): Promise<IChatSession> {
    const initialMessages = input.initialMessage
      ? [{ author: 'ai' as ChatAuthor, text: input.initialMessage, createdAt: new Date() }]
      : [{ author: 'ai' as ChatAuthor, text: "Je suis là. Qu'est-ce qui se passe là, maintenant ?", createdAt: new Date() }];

    const session = new ChatSession({
      patientId: input.patientId,
      therapistId: input.therapistId,
      messages: initialMessages,
    });

    return session.save();
  }

  /**
   * Trouver une session par ID
   */
  async findById(id: string): Promise<IChatSession | null> {
    return ChatSession.findById(id);
  }

  /**
   * Lister les sessions d'un thérapeute
   */
  async findByTherapist(therapistId: string): Promise<IChatSession[]> {
    return ChatSession.find({ therapistId })
      .sort({ createdAt: -1 })
      .limit(100);
  }

  /**
   * Lister les sessions d'un patient
   */
  async findByPatient(patientId: string): Promise<IChatSession[]> {
    return ChatSession.find({ patientId })
      .sort({ createdAt: -1 });
  }

  /**
   * Ajouter un message à une session
   */
  async addMessage(sessionId: string, input: AddMessageInput): Promise<IChatSession | null> {
    return ChatSession.findByIdAndUpdate(
      sessionId,
      {
        $push: {
          messages: {
            author: input.author,
            text: input.text.trim(),
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
  }

  /**
   * Définir la sévérité d'une session
   */
  async setSeverity(sessionId: string, severity: Severity): Promise<IChatSession | null> {
    return ChatSession.findByIdAndUpdate(
      sessionId,
      { severity },
      { new: true }
    );
  }

  /**
   * Définir le résumé et les mots-clés d'une session
   */
  async setSummaryAndKeywords(
    sessionId: string,
    summary: string,
    keywords: string[]
  ): Promise<IChatSession | null> {
    return ChatSession.findByIdAndUpdate(
      sessionId,
      {
        summary: summary.trim(),
        keywords: keywords.map((k) => k.trim()).filter(Boolean).slice(0, 8),
      },
      { new: true }
    );
  }

  /**
   * Extraire automatiquement un résumé simple (fallback sans IA)
   */
  extractSimpleSummary(session: IChatSession): { summary: string; keywords: string[] } {
    const patientMessages = session.messages.filter((m) => m.author === 'patient');
    const patientText = patientMessages.map((m) => m.text).join(' ');

    // Extraction de mots-clés basique
    const stopWords = ['avec', 'mais', 'pour', 'dans', 'plus', 'comme', 'trop', 'tout', 'cette', 'cela', 'être', 'avoir', 'faire'];
    const words = patientText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.includes(w));

    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }

    const keywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([w]) => w);

    const lastPatientMsg = patientMessages.at(-1)?.text ?? '';
    const summary = lastPatientMsg
      ? `Dernier point: ${lastPatientMsg.slice(0, 140)}${lastPatientMsg.length > 140 ? '…' : ''}`
      : 'Aucun message patient.';

    return { summary, keywords };
  }
}

export const chatService = new ChatService();
