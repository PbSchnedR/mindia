import { useRouter, useRootNavigationState } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { useIsDesktop } from '@/hooks/use-breakpoint';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session-context';
import type { ChatMessage } from '@/lib/types';
import { colors, spacing, radius, shadows, font, layout } from '@/constants/tokens';

export default function PatientChatScreen() {
  const { session, signOut, loading: sessionLoading } = useSession();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const isDesktop = useIsDesktop();
  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const didInitialScrollRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const hasRedirected = useRef(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<
    { id: string; createdAt: string; lastMessage?: { from: string; text: string; createdAt: string } | null }[]
  >([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'waiting' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const normalize = useCallback((raw: ChatMessage[] | null | undefined): ChatMessage[] => {
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, []);

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);

  // ─── Init ───────────────────────────────────────────
  useEffect(() => {
    if (sessionLoading || !rootNavState?.key) return;
    if (!session || session.role !== 'patient') {
      if (!hasRedirected.current) { hasRedirected.current = true; router.replace('/'); }
      return;
    }
    (async () => {
      setLoading(true);
      try {
        setBackendOk(await api.isAvailable());
        const { conversations: convs } = await api.conversations.listForUser(session.patientId);
        let currentConvId: string | null = null;

        if (convs.length === 0) {
          const { conversation } = await api.conversations.create(session.patientId);
          currentConvId = conversation.id;
          setConversations([buildConvItem(conversation)]);
        } else {
          currentConvId = convs[0].id;
          setConversations(convs);
        }
        setConversationId(currentConvId);
        if (currentConvId) {
          const { messages } = await api.conversations.getMessages(session.patientId, currentConvId);
          setMessages(normalize(mapMessages(messages)));
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Erreur', 'Impossible de charger la conversation.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session, sessionLoading, rootNavState?.key]);

  useEffect(() => {
    if (loading || didInitialScrollRef.current || messages.length === 0) return;
    didInitialScrollRef.current = true;
    shouldAutoScrollRef.current = true;
    scrollToBottom(false);
  }, [loading, messages.length, scrollToBottom]);

  // ─── Helpers ──────────────────────────────────────────
  const mapMessages = (raw: any[]): ChatMessage[] =>
    (raw || []).map((m: any, i: number) => ({
      id: m._id || String(i),
      author: m.author ?? m.from,
      text: m.text,
      createdAt: m.createdAt || new Date().toISOString(),
    }));

  const buildConvItem = (conversation: any) => {
    const msgs = conversation.messages || [];
    const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      lastMessage: last ? { from: last.from, text: last.text, createdAt: last.createdAt } : null,
    };
  };

  const getMockAIResponse = (msg: string): string => {
    const lc = msg.toLowerCase();
    if (lc.includes('stress')) return "Je comprends que tu te sentes stressé·e. As-tu essayé des techniques de respiration ?";
    if (lc.includes('anxieux') || lc.includes('angoisse')) return "L'anxiété peut être envahissante. Prendre le temps de mettre des mots dessus peut déjà aider.";
    if (lc.includes('triste')) return "La tristesse fait partie de l'expérience humaine. As-tu pu identifier ce qui a déclenché ce sentiment ?";
    if (lc.includes('mieux') || lc.includes('bien')) return "C'est positif ! Continue à prendre soin de toi.";
    const generics = [
      "Merci d'avoir partagé ça. Peux-tu m'en dire un peu plus ?",
      "Je t'écoute. Prends ton temps pour mettre des mots sur ce que tu vis.",
      "C'est courageux de ta part d'exprimer ce que tu ressens.",
    ];
    return generics[Math.floor(Math.random() * generics.length)];
  };

  // ─── Send ─────────────────────────────────────────────
  const handleSend = async () => {
    if (!conversationId || !session || session.role !== 'patient') return;
    const text = currentText.trim();
    if (!text) { setSendError('Écris un message.'); return; }

    setSendError(null);
    setSendStatus('sending');
    setSending(true);
    shouldAutoScrollRef.current = true;

    try {
      const optimistic: ChatMessage = { id: `tmp_${Date.now()}`, author: 'patient', text, createdAt: new Date().toISOString() };
      setMessages((prev) => normalize([...prev, optimistic]));
      scrollToBottom(true);

      const { messages: updatedMessages } = await api.conversations.addMessage(session.patientId, conversationId, 'patient', text);
      const normalizedUpdated = normalize(mapMessages(updatedMessages));
      setMessages(normalizedUpdated);
      setCurrentText('');
      setSendStatus('waiting');

      await new Promise((r) => setTimeout(r, 800));

      let aiResponse = '';
      try {
        const context = normalizedUpdated.slice(-12).map((m) => ({ from: m.author as any, text: m.text }));
        const result = await api.ai.reply(context);
        aiResponse = result.reply;
      } catch {
        aiResponse = getMockAIResponse(text);
        setSendError('IA indisponible, réponse automatique.');
      }

      const { messages: autoMessages } = await api.conversations.addMessage(session.patientId, conversationId, 'ai', aiResponse);
      setMessages(normalize(mapMessages(autoMessages)));
      setSendStatus('idle');
    } catch (e) {
      console.error(e);
      setSendStatus('error');
      setSendError("Le message n'a pas pu être envoyé.");
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = async (id: string) => {
    if (!session || id === conversationId) return;
    setConversationId(id);
    setLoading(true);
    try {
      const { messages } = await api.conversations.getMessages(session.patientId, id);
      setMessages(normalize(mapMessages(messages)));
      didInitialScrollRef.current = false;
    } catch { Alert.alert('Erreur', 'Impossible de charger cette conversation.'); }
    finally { setLoading(false); }
  };

  const handleNewConversation = async () => {
    if (!session) return;
    try {
      const { conversation } = await api.conversations.create(session.patientId);
      setConversations((prev) => [buildConvItem(conversation), ...prev]);
      setConversationId(conversation.id);
      setMessages([]);
      didInitialScrollRef.current = false;
    } catch { Alert.alert('Erreur', 'Impossible de créer une conversation.'); }
  };

  // ─── Sidebar ──────────────────────────────────────────
  const renderSidebar = () => (
    <View style={s.sidebarInner}>
      <View style={s.sidebarHeader}>
        <Text style={font.sectionTitle}>Conversations</Text>
        {!isDesktop && (
          <Pressable onPress={() => setSidebarOpen(false)} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      <Pressable onPress={handleNewConversation} style={s.sidebarNewBtn}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={[font.bodyMedium, { color: colors.primary }]}>Nouvelle conversation</Text>
      </Pressable>
      <View style={s.sidebarList}>
        {conversations.length === 0 ? (
          <Text style={[font.caption, { padding: spacing.md }]}>Aucune conversation.</Text>
        ) : (
          conversations.map((c) => {
            const active = c.id === conversationId;
            return (
              <Pressable
                key={c.id}
                onPress={async () => { await handleSelectConversation(c.id); if (!isDesktop) setSidebarOpen(false); }}
                style={[s.convItem, active && s.convItemActive]}
              >
                <Ionicons
                  name={active ? 'chatbubble' : 'chatbubble-outline'}
                  size={16}
                  color={active ? colors.textOnPrimary : colors.textTertiary}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.convTitle, active && s.convTitleActive]} numberOfLines={1}>
                    {c.lastMessage?.text?.slice(0, 40) || 'Nouvelle conversation'}
                  </Text>
                  <Text style={[font.caption, active && { color: colors.primaryMedium }]}>
                    {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const isPatient = item.author === 'patient';
    const isAi = item.author === 'ai';
    return (
      <View style={[s.bubbleWrap, { alignItems: isPatient ? 'flex-end' : 'flex-start' }]}>
        {!isPatient && (
          <View style={[s.avatarDot, isAi ? s.avatarAi : s.avatarTherapist]}>
            <Ionicons
              name={isAi ? 'sparkles' : 'person'}
              size={12}
              color={isAi ? colors.ai : colors.success}
            />
          </View>
        )}
        <View style={[s.bubble, isPatient ? s.bubblePatient : isAi ? s.bubbleAi : s.bubbleTherapist]}>
          <Text style={[s.bubbleText, isPatient && { color: colors.textOnPrimary }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1, backgroundColor: isDesktop ? colors.bgDesktop : colors.bg }}
    >
      <View style={s.container}>
        {Platform.OS === 'android' && <View style={{ paddingTop: layout.safeAreaTop }} />}
        <View style={[s.appLayout, isDesktop && s.appLayoutDesktop]}>
          {/* Desktop sidebar */}
          {isDesktop && <View style={s.sidebar}>{renderSidebar()}</View>}

          {/* Main chat area */}
          <View style={[s.main, isDesktop && s.mainDesktop]}>
            {/* Header */}
            <View style={[s.headerBar, isDesktop && s.headerBarDesktop]}>
              <View style={s.headerLeft}>
                {!isDesktop && (
                  <Pressable onPress={() => setSidebarOpen(true)} hitSlop={10} style={s.menuBtn}>
                    <Ionicons name="menu-outline" size={22} color={colors.text} />
                  </Pressable>
                )}
                <View style={s.headerTitleWrap}>
                  <Text style={s.headerTitle}>Ma bulle</Text>
                  {sendStatus === 'waiting' ? (
                    <Text style={[font.caption, { color: colors.primary }]}>L'IA réfléchit…</Text>
                  ) : (
                    <Text style={font.caption}>Un espace pour déposer ce que tu ressens</Text>
                  )}
                </View>
              </View>
              <Pressable
                onPress={() => router.replace('/patient/dashboard')}
                style={s.backBtn}
              >
                <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                <Text style={[font.bodySmall, { fontWeight: '600' }]}>Accueil</Text>
              </Pressable>
            </View>

            {/* Intro when no messages */}
            {messages.length === 0 && !loading && (
              <View style={s.introContainer}>
                <View style={s.introCard}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chatbubbles" size={32} color={colors.primary} />
                  </View>
                  <Text style={[font.subtitle, { textAlign: 'center' }]}>Bienvenue dans ta bulle</Text>
                  <Text style={[font.bodySmall, { textAlign: 'center', maxWidth: 320 }]}>
                    Cet espace est le tien. Comment veux-tu commencer ?
                  </Text>
                  <View style={s.introOptions}>
                    {[
                      { icon: 'chatbubble-outline' as const, label: 'Parler de ce que je ressens', text: "J'aimerais parler de ce que je ressens en ce moment." },
                      { icon: 'calendar-outline' as const, label: 'Préparer ma prochaine séance', text: "J'aimerais préparer des points à aborder lors de ma prochaine séance." },
                      { icon: 'alert-circle-outline' as const, label: "J'ai besoin d'aide maintenant", text: "Je ne me sens pas bien et j'ai besoin d'aide." },
                      { icon: 'book-outline' as const, label: 'En savoir plus', text: "Qu'est-ce que je peux faire dans cet espace ?" },
                    ].map((opt, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [s.introOption, pressed && s.introOptionPressed]}
                        onPress={() => setCurrentText(opt.text)}
                      >
                        <View style={s.introOptionIcon}>
                          <Ionicons name={opt.icon} size={18} color={colors.primary} />
                        </View>
                        <Text style={[font.bodyMedium, { flex: 1 }]}>{opt.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Messages */}
            <FlatList
              ref={(r) => { listRef.current = r; }}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={renderBubble}
              contentContainerStyle={s.messagesList}
              style={{ flex: 1 }}
              onContentSizeChange={() => { if (shouldAutoScrollRef.current) scrollToBottom(false); }}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                shouldAutoScrollRef.current = contentSize.height - (layoutMeasurement.height + contentOffset.y) < 80;
              }}
              scrollEventThrottle={16}
            />

            {/* Input area */}
            <View style={[s.inputArea, isDesktop && s.inputAreaDesktop]}>
              {backendOk === false && (
                <View style={s.warningBanner}>
                  <Ionicons name="warning-outline" size={14} color={colors.warning} />
                  <Text style={[font.caption, { color: colors.warning }]}>Serveur indisponible</Text>
                </View>
              )}
              {sendError && (
                <Text style={[font.caption, { color: colors.error, paddingHorizontal: spacing.sm }]}>{sendError}</Text>
              )}
              <View style={s.inputRow}>
                <TextInput
                  placeholder="Écris ici ce qui se passe pour toi…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  style={s.input}
                  value={currentText}
                  onChangeText={setCurrentText}
                />
                <Pressable
                  onPress={handleSend}
                  disabled={sending || !currentText.trim()}
                  style={[s.sendBtn, (sending || !currentText.trim()) && s.sendBtnDisabled]}
                >
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={sending || !currentText.trim() ? colors.textTertiary : colors.textOnPrimary}
                  />
                </Pressable>
              </View>
              <Text style={[font.caption, { textAlign: 'center', marginTop: spacing.xs }]}>
                En cas de danger immédiat, appelle le 15 / 112.
              </Text>
            </View>
          </View>
        </View>

        {/* Mobile sidebar overlay */}
        {!isDesktop && sidebarOpen && (
          <View style={s.sidebarOverlay}>
            <Pressable style={s.sidebarBackdrop} onPress={() => setSidebarOpen(false)} />
            <View style={s.sidebarDrawer}>{renderSidebar()}</View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  appLayout: { flex: 1, flexDirection: 'column' },
  appLayoutDesktop: { flexDirection: 'row' },

  // Main
  main: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mainDesktop: {
    borderRadius: 0,
    margin: 0,
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerBarDesktop: {
    paddingHorizontal: spacing['2xl'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...font.sectionTitle,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
  },

  // Intro
  introContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  introCard: {
    maxWidth: 440,
    width: '100%',
    borderRadius: radius['2xl'],
    padding: spacing['3xl'],
    gap: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  introOptions: {
    width: '100%',
    gap: spacing.sm,
  },
  introOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  introOptionPressed: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryMedium,
  },
  introOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Messages
  messagesList: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  bubbleWrap: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarAi: {
    backgroundColor: colors.aiLight,
  },
  avatarTherapist: {
    backgroundColor: colors.successLight,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubblePatient: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  bubbleAi: {
    backgroundColor: colors.bgSecondary,
    borderBottomLeftRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bubbleTherapist: {
    backgroundColor: colors.successLight,
    borderBottomLeftRadius: spacing.xs,
  },
  bubbleText: {
    ...font.body,
  },

  // Input
  inputArea: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.xs,
  },
  inputAreaDesktop: {
    paddingHorizontal: spacing['2xl'],
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    backgroundColor: colors.bgSecondary,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.bgTertiary,
  },

  // Sidebar
  sidebar: {
    width: 280,
    backgroundColor: colors.bg,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
  sidebarInner: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryMedium,
  },
  sidebarList: {
    gap: spacing.xs,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  convItemActive: {
    backgroundColor: colors.primary,
  },
  convTitle: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  convTitleActive: {
    fontWeight: '600',
    color: colors.textOnPrimary,
  },

  // Mobile sidebar
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 100,
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
  },
  sidebarDrawer: {
    width: 300,
    backgroundColor: colors.bg,
    ...shadows.lg,
  },
});
